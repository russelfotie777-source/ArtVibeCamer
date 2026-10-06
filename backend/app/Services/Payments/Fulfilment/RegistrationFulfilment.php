<?php

namespace App\Services\Payments\Fulfilment;

use App\Enums\CandidateStatus;
use App\Models\Candidate;
use App\Models\Category;
use App\Models\Setting;
use App\Models\Transaction;
use Illuminate\Support\Facades\Log;

/**
 * Frais d'inscription encaisses : le dossier du candidat entre dans le
 * circuit de validation et recoit son numero de scene.
 */
class RegistrationFulfilment implements Fulfilment
{
    public function fulfil(Transaction $transaction): void
    {
        $candidate = $transaction->payable;

        if (! $candidate instanceof Candidate) {
            Log::error('Inscription: transaction sans candidat rattache', [
                'transaction' => $transaction->reference,
            ]);

            return;
        }

        // Idempotence : un numero deja attribue signifie que l'encaissement a
        // deja ete traite, un rejeu de webhook ne doit rien recompter.
        if ($candidate->candidate_number !== null) {
            return;
        }

        // Verrou sur la categorie : deux inscriptions payees au meme instant
        // ne doivent pas recevoir le meme numero.
        $category = Category::query()->lockForUpdate()->find($candidate->category_id);

        $candidate->candidate_number = $this->nextNumber($category);
        $candidate->registration_transaction_id = $transaction->id;

        // L'organisation peut choisir de publier les candidats directement ou
        // de garder une etape de validation manuelle des dossiers.
        $candidate->status = Setting::get('auto_approve_candidates', false)
            ? CandidateStatus::Active
            : CandidateStatus::PendingReview;

        $candidate->save();

        $category->increment('candidates_count');
    }

    /**
     * Le dossier retombe en attente de paiement : le candidat peut relancer
     * l'encaissement sans ressaisir son formulaire.
     */
    public function revert(Transaction $transaction): void
    {
        $candidate = $transaction->payable;

        if ($candidate instanceof Candidate && $candidate->candidate_number === null) {
            $candidate->update(['status' => CandidateStatus::AwaitingPayment]);
        }
    }

    /** AVC-MUS-001, AVC-MUS-002, ... par categorie. */
    private function nextNumber(Category $category): string
    {
        $taken = Candidate::query()
            ->withTrashed()
            ->where('category_id', $category->id)
            ->whereNotNull('candidate_number')
            ->count();

        return sprintf('AVC-%s-%03d', $category->code(), $taken + 1);
    }
}
