<?php

namespace App\Http\Controllers\Api\V1\Site;

use App\Http\Controllers\Controller;
use App\Http\Resources\CandidateResource;
use App\Models\Candidate;
use Illuminate\Http\Request;

class CandidateController extends Controller
{
    public function index(Request $request)
    {
        $candidates = Candidate::query()
            ->visible()
            ->with('category:id,name,slug,vote_price,voting_opens_at,voting_closes_at,is_active')
            ->when($request->filled('category'), fn ($q) => $q->whereHas(
                'category',
                fn ($c) => $c->where('slug', $request->string('category'))
            ))
            ->search($request->string('search')->toString())
            ->ranked()
            ->paginate(min($request->integer('per_page', 24), 60))
            ->withQueryString();

        return CandidateResource::collection($candidates);
    }

    /** Page publique d'un candidat : photo, numero, categorie, voix, bouton voter. */
    public function show(Candidate $candidate)
    {
        abort_unless($candidate->status->isPubliclyVisible(), 404);

        $candidate->load(['category', 'members']);

        return CandidateResource::make($candidate)->additional([
            'meta' => [
                'rank' => $candidate->rank(),
                'category_candidates' => $candidate->category->candidates_count,
            ],
        ]);
    }
}
