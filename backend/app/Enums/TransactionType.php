<?php

namespace App\Enums;

enum TransactionType: string
{
    case Registration = 'registration';
    case Vote = 'vote';
    case Ticket = 'ticket';

    public function label(): string
    {
        return match ($this) {
            self::Registration => 'Frais d\'inscription',
            self::Vote => 'Achat de votes',
            self::Ticket => 'Achat de tickets',
        };
    }

    /** Segment utilise dans les references de transaction (AVC-INS-...). */
    public function referenceSegment(): string
    {
        return match ($this) {
            self::Registration => 'INS',
            self::Vote => 'VOT',
            self::Ticket => 'TIC',
        };
    }
}
