<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\CandidateStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\CandidateResource;
use App\Models\Candidate;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CandidateController extends Controller
{
    public function index(Request $request)
    {
        $candidates = Candidate::query()
            // Relation complete : CandidateResource imbrique CategoryResource,
            // qui lit les tarifs et les fenetres d'ouverture. Une selection
            // partielle de colonnes les ferait sortir a null.
            ->with('category')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', $request->integer('category_id')))
            ->when($request->boolean('unpaid'), fn ($q) => $q->whereNull('candidate_number'))
            ->search($request->string('search')->toString())
            ->orderByDesc('created_at')
            ->paginate(min($request->integer('per_page', 25), 100))
            ->withQueryString();

        return CandidateResource::collection($candidates);
    }

    public function show(Candidate $candidate)
    {
        return CandidateResource::make(
            $candidate->load(['category', 'registrationTransaction', 'reviewer:id,name'])
        );
    }

    public function update(Request $request, Candidate $candidate): JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:100'],
            'last_name' => ['sometimes', 'string', 'max:100'],
            'stage_name' => ['nullable', 'string', 'max:100'],
            'presentation' => ['nullable', 'string', 'max:2000'],
            'city' => ['nullable', 'string', 'max:100'],
            'region' => ['nullable', 'string', 'max:100'],
            'is_featured' => ['sometimes', 'boolean'],
            'category_id' => ['sometimes', 'integer', Rule::exists('categories', 'id')],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        if ($request->hasFile('photo')) {
            $data['photo_path'] = $request->file('photo')->store('candidates', 'public');
        }

        $before = $candidate->only(array_keys($data));
        $candidate->update($data);

        Audit::log('candidate.updated', $candidate, "Fiche de {$candidate->display_name} modifiee", [
            'before' => $before,
            'after' => $data,
        ]);

        return response()->json([
            'message' => 'Fiche mise à jour.',
            'candidate' => CandidateResource::make($candidate->fresh(['category'])),
        ]);
    }

    /** Validation d'un dossier : le candidat devient visible et votable. */
    public function approve(Request $request, Candidate $candidate): JsonResponse
    {
        abort_if(
            $candidate->candidate_number === null,
            422,
            'Les frais d\'inscription de ce candidat ne sont pas encore encaissés.'
        );

        $candidate->update([
            'status' => CandidateStatus::Active,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'rejection_reason' => null,
        ]);

        Audit::log('candidate.approved', $candidate, "{$candidate->display_name} valide");

        return response()->json([
            'message' => 'Candidat validé.',
            'candidate' => CandidateResource::make($candidate->fresh(['category'])),
        ]);
    }

    public function reject(Request $request, Candidate $candidate): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $candidate->update([
            'status' => CandidateStatus::Rejected,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'rejection_reason' => $data['reason'],
        ]);

        Audit::log('candidate.rejected', $candidate, "{$candidate->display_name} rejete", $data);

        return response()->json([
            'message' => 'Candidat rejeté.',
            'candidate' => CandidateResource::make($candidate->fresh(['category'])),
        ]);
    }

    /**
     * Suppression douce : un candidat ayant paye ou recu des votes ne doit pas
     * disparaitre des comptes de l'evenement.
     */
    public function destroy(Candidate $candidate): JsonResponse
    {
        abort_if(
            $candidate->votes_count > 0,
            422,
            'Ce candidat a reçu des votes payants et ne peut pas être supprimé. Utilisez le statut « retiré ».'
        );

        $candidate->delete();

        Audit::log('candidate.deleted', $candidate, "{$candidate->display_name} supprime");

        return response()->json(['message' => 'Candidat supprimé.']);
    }
}
