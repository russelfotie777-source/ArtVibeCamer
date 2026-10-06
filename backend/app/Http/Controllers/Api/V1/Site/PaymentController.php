<?php

namespace App\Http\Controllers\Api\V1\Site;

use App\Http\Controllers\Controller;
use App\Http\Resources\TransactionResource;
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

        return TransactionResource::make($transaction);
    }
}
