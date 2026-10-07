<?php

namespace App\Http\Controllers\Api\V1\Site;

use App\Enums\TransactionType;
use App\Http\Controllers\Controller;
use App\Http\Resources\TransactionResource;
use App\Models\Candidate;
use App\Models\Transaction;
use App\Services\Payments\PaymentProcessor;

class PaymentController extends Controller
{
    public function __construct(private readonly PaymentProcessor $payments) {}

    /**
     * Suivi d'un paiement par le payeur.
     *
     * Le front interroge cette route pendant que l'utilisateur valide sur son
     * telephone. Si la notification de la passerelle se fait attendre, on
     * verifie directement aupres d'elle plutot que de laisser l'ecran tourner
     * indefiniment.
     */
    public function show(Transaction $transaction)
    {
        if ($transaction->status->isAwaitingPayer()
            && $transaction->processing_at?->lt(now()->subSeconds(20))) {
            $transaction = $this->payments->refresh($transaction);
        }

        return TransactionResource::make($transaction)->additional([
            'meta' => ['candidate' => $this->candidat($transaction)],
        ]);
    }

    /**
     * Resume du candidat pour une transaction d'inscription, afin que le
     * candidat voie son numero des la confirmation du paiement.
     *
     * Divulgation acceptable : la reference de transaction est aleatoire et
     * n'est connue que de lui. On s'en tient malgre tout au strict
     * necessaire, sans coordonnees personnelles.
     */
    private function candidat(Transaction $transaction): ?array
    {
        if ($transaction->type !== TransactionType::Registration) {
            return null;
        }

        $candidate = $transaction->payable;

        if (! $candidate instanceof Candidate) {
            return null;
        }

        return [
            'candidate_number' => $candidate->candidate_number,
            'display_name' => $candidate->display_name,
            'slug' => $candidate->slug,
            'status' => $candidate->status->value,
            'status_label' => $candidate->status->label(),
            'category' => $candidate->loadMissing('category')->category?->name,
        ];
    }
}
