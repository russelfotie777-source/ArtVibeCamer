<?php

namespace App\Enums;

enum VoteStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Failed = 'failed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'En attente de paiement',
            self::Confirmed => 'Confirme',
            self::Failed => 'Echoue',
            self::Cancelled => 'Annule',
        };
    }

    /** Seuls les lots confirmes alimentent les classements. */
    public function countsTowardsTally(): bool
    {
        return $this === self::Confirmed;
    }
}
