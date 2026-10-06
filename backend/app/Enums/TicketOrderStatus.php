<?php

namespace App\Enums;

enum TicketOrderStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Cancelled = 'cancelled';
    case Expired = 'expired';
    case Refunded = 'refunded';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'En attente de paiement',
            self::Paid => 'Payee',
            self::Cancelled => 'Annulee',
            self::Expired => 'Expiree',
            self::Refunded => 'Remboursee',
        };
    }

    /** Les billets ne sont emis que dans cet etat. */
    public function hasIssuedTickets(): bool
    {
        return $this === self::Paid;
    }

    /** La jauge reservee doit etre rendue a la vente. */
    public function releasesInventory(): bool
    {
        return in_array($this, [self::Cancelled, self::Expired, self::Refunded], true);
    }
}
