<?php

namespace App\Enums;

enum PaymentMethod: string
{
    case MtnMomo = 'mtn_momo';
    case OrangeMoney = 'orange_money';
    case Card = 'card';
    case Bank = 'bank';
    case Cash = 'cash';
    case Manual = 'manual';

    public function label(): string
    {
        return match ($this) {
            self::MtnMomo => 'MTN Mobile Money',
            self::OrangeMoney => 'Orange Money',
            self::Card => 'Carte bancaire',
            self::Bank => 'Virement bancaire',
            self::Cash => 'Especes',
            self::Manual => 'Saisie manuelle',
        };
    }

    public function isMobileMoney(): bool
    {
        return in_array($this, [self::MtnMomo, self::OrangeMoney], true);
    }

    /** Encaissement enregistre par l'organisation, hors passerelle en ligne. */
    public function isOffline(): bool
    {
        return in_array($this, [self::Cash, self::Bank, self::Manual], true);
    }

    /**
     * Deduit l'operateur a partir du prefixe d'un numero camerounais.
     * MTN : 67, 650-654, 680-684 | Orange : 69, 655-659, 685-689
     */
    public static function fromCameroonPhone(string $phone): ?self
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';
        $local = str_starts_with($digits, '237') ? substr($digits, 3) : $digits;

        if (strlen($local) !== 9) {
            return null;
        }

        $two = substr($local, 0, 2);
        $three = (int) substr($local, 0, 3);

        return match (true) {
            $two === '67' => self::MtnMomo,
            $two === '69' => self::OrangeMoney,
            $three >= 650 && $three <= 654 => self::MtnMomo,
            $three >= 655 && $three <= 659 => self::OrangeMoney,
            $three >= 680 && $three <= 684 => self::MtnMomo,
            $three >= 685 && $three <= 689 => self::OrangeMoney,
            default => null,
        };
    }
}
