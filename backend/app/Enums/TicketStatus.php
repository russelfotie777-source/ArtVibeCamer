<?php

namespace App\Enums;

enum TicketStatus: string
{
    case Valid = 'valid';
    case Used = 'used';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Valid => 'Valide',
            self::Used => 'Deja utilise',
            self::Cancelled => 'Annule',
        };
    }
}
