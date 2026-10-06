<?php

namespace App\Services\Payments;

use App\Models\Transaction;
use Illuminate\Database\Eloquent\Model;

/**
 * Resultat d'un parcours d'achat : ce qui a ete cree, et ce que le payeur
 * doit faire ensuite.
 */
final readonly class CheckoutResult
{
    public function __construct(
        public Model $subject,
        public Transaction $transaction,
        public PaymentIntent $intent,
    ) {}
}
