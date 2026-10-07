<?php

namespace App\Services\Payments;

use App\Enums\PaymentMethod;
use App\Enums\TransactionStatus;

/** Etat d'un encaissement tel que rapporte par la passerelle. */
final readonly class PaymentStatus
{
    public function __construct(
        public TransactionStatus $status,
        public ?string $providerReference = null,
        public ?PaymentMethod $method = null,
        public ?string $payerPhone = null,
        public ?int $amount = null,
        /** Commission prelevee par la passerelle, si elle la communique. */
        public ?int $fees = null,
        /** Montant reellement credite au compte, commission deduite. */
        public ?int $netAmount = null,
        public ?string $failureReason = null,
        public array $raw = [],
    ) {}
}
