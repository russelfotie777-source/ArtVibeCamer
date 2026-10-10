<?php

namespace App\Enums;

enum RegistrationType: string
{
    case Solo = 'solo';
    case Group = 'group';

    public function label(): string
    {
        return match ($this) {
            self::Solo => 'Individuel',
            self::Group => 'Groupe',
        };
    }

    public function isGroup(): bool
    {
        return $this === self::Group;
    }
}
