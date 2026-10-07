<?php

namespace App\Enums;

enum TransactionStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Succeeded = 'succeeded';
    case Failed = 'failed';
    case Cancelled = 'cancelled';
    case Expired = 'expired';
    case Refunded = 'refunded';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'En attente',
            self::Processing => 'Paiement en cours',
            self::Succeeded => 'Payé',
            self::Failed => 'Échoué',
            self::Cancelled => 'Annulé',
            self::Expired => 'Expiré',
            self::Refunded => 'Remboursé',
        };
    }

    /** Etat final : plus aucune transition possible, webhook en retard ignore. */
    public function isFinal(): bool
    {
        return in_array($this, [self::Succeeded, self::Failed, self::Cancelled, self::Expired, self::Refunded], true);
    }

    public function isSuccessful(): bool
    {
        return $this === self::Succeeded;
    }

    /** Le payeur peut encore valider sur son telephone. */
    public function isAwaitingPayer(): bool
    {
        return in_array($this, [self::Pending, self::Processing], true);
    }
}
