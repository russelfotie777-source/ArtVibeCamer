<?php

namespace App\Services\Payments\Fulfilment;

use App\Enums\VoteStatus;
use App\Models\Candidate;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\Vote;
use Illuminate\Support\Facades\Log;

/**
 * Votes payes : les voix sont creditees au candidat.
 *
 * C'est le seul endroit du code qui incremente un compteur de votes. Toute
 * autre voie d'augmentation serait une faille : les voix ne naissent que
 * d'un encaissement confirme.
 */
class VoteFulfilment implements Fulfilment
{
    public function fulfil(Transaction $transaction): void
    {
        $vote = $transaction->payable;

        if (! $vote instanceof Vote) {
            Log::error('Vote: transaction sans lot de votes rattache', [
                'transaction' => $transaction->reference,
            ]);

            return;
        }

        // Idempotence : un lot deja confirme ne doit jamais etre recompte.
        if ($vote->status === VoteStatus::Confirmed) {
            return;
        }

        $vote->update([
            'status' => VoteStatus::Confirmed,
            'confirmed_at' => now(),
        ]);

        Candidate::whereKey($vote->candidate_id)->increment('votes_count', $vote->quantity);
        Category::whereKey($vote->category_id)->increment('votes_count', $vote->quantity);
    }

    public function revert(Transaction $transaction): void
    {
        $vote = $transaction->payable;

        if (! $vote instanceof Vote) {
            return;
        }

        // Si le lot avait ete credite, on retire les voix avant de l'invalider.
        if ($vote->status === VoteStatus::Confirmed) {
            Candidate::whereKey($vote->candidate_id)->decrement('votes_count', $vote->quantity);
            Category::whereKey($vote->category_id)->decrement('votes_count', $vote->quantity);
        }

        $vote->update(['status' => VoteStatus::Failed]);
    }
}
