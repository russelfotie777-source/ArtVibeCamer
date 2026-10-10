<?php

namespace App\Services\Payments;

/**
 * Notification entrante normalisee.
 *
 * `eventId` sert de cle d'idempotence : les passerelles Mobile Money rejouent
 * leurs notifications jusqu'a obtenir un 2xx, un meme evenement peut donc
 * arriver plusieurs fois.
 */
final readonly class WebhookEvent
{
    public function __construct(
        public bool $signatureValid,
        public ?string $eventId,
        public ?string $transactionReference,
        public ?string $providerReference,
        public ?PaymentStatus $status,
        public array $payload = [],
    ) {}

    public function isActionable(): bool
    {
        return $this->signatureValid
            && $this->status !== null
            && ($this->transactionReference !== null || $this->providerReference !== null);
    }
}
