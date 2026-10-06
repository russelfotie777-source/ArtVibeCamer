<?php

namespace App\Services\Payments;

use App\Enums\TransactionStatus;

/**
 * Resultat du lancement d'un encaissement.
 *
 * Deux parcours coexistent chez les passerelles camerounaises :
 *  - USSD direct : le payeur recoit une demande de code sur son telephone,
 *    on lui affiche `instructions` et on attend le webhook ;
 *  - page hebergee : on redirige vers `redirectUrl`.
 * Le DTO porte les deux pour que l'appelant n'ait pas a connaitre le driver.
 */
final readonly class PaymentIntent
{
    public function __construct(
        public TransactionStatus $status,
        public ?string $providerReference = null,
        public ?string $redirectUrl = null,
        public ?string $instructions = null,
        public ?string $failureReason = null,
        public array $raw = [],
    ) {}

    public function requiresRedirect(): bool
    {
        return $this->redirectUrl !== null;
    }
}
