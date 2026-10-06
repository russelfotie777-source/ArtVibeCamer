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
            self::Accepted => 'Entree autorisee',
            self::AlreadyUsed => 'Billet deja utilise',
            self::NotFound => 'Billet inconnu',
            self::Cancelled => 'Billet annule',
            self::OrderUnpaid => 'Commande non payee',
        };
    }

    public function grantsEntry(): bool
    {
        return $this === self::Accepted;
    }
}
