<?php

namespace App\Enums;

enum ScanResult: string
{
    case Accepted = 'accepted';
    case AlreadyUsed = 'already_used';
    case NotFound = 'not_found';
    case Cancelled = 'cancelled';
    case OrderUnpaid = 'order_unpaid';

    public function label(): string
    {
        return match ($this) {
            self::Accepted => 'Entrée autorisée',
            self::AlreadyUsed => 'Billet déjà utilisé',
            self::NotFound => 'Billet inconnu',
            self::Cancelled => 'Billet annulé',
            self::OrderUnpaid => 'Commande non payée',
        };
    }

    public function grantsEntry(): bool
    {
        return $this === self::Accepted;
    }
}
