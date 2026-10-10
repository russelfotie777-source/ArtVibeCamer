<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Numero de telephone camerounais.
 *
 * Accepte les formes courantes (06 71 23 45 67, +237 671 234 567, 671234567)
 * et verifie que le prefixe correspond a un operateur mobile reel : un numero
 * mal saisi est un paiement Mobile Money qui n'aboutira jamais, et un billet
 * ou un vote impossible a rattacher a son acheteur.
 */
class CameroonPhone implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $digits = preg_replace('/\D/', '', (string) $value) ?? '';
        $local = str_starts_with($digits, '237') ? substr($digits, 3) : $digits;

        if (strlen($local) !== 9) {
            $fail('Le numéro doit comporter 9 chiffres, par exemple 671 23 45 67.');

            return;
        }

        // Mobile : 6 suivi de 5x (MTN/Orange), 7x (MTN), 8x, 9x (Orange).
        if (! preg_match('/^6(5|6|7|8|9)\d{7}$/', $local)) {
            $fail('Ce numéro ne correspond pas à un mobile camerounais.');
        }
    }

    /** Forme canonique stockee en base : 237XXXXXXXXX. */
    public static function normalize(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $digits = preg_replace('/\D/', '', $value) ?? '';

        if ($digits === '') {
            return null;
        }

        return str_starts_with($digits, '237') ? $digits : '237'.$digits;
    }
}
