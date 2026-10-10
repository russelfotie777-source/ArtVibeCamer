<?php

namespace App\Services\Payments\Fulfilment;

use App\Models\Transaction;

/**
 * Contrepartie a delivrer quand un encaissement est confirme.
 *
 * Chaque implementation doit etre idempotente : une passerelle peut rejouer
 * la meme notification plusieurs fois, et la verification manuelle depuis le
 * back-office peut confirmer une transaction deja traitee.
 */
interface Fulfilment
{
    public function fulfil(Transaction $transaction): void;

    /** Appele quand le paiement echoue, expire ou est annule. */
    public function revert(Transaction $transaction): void;
}
