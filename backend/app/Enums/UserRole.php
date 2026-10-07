<?php

namespace App\Enums;

enum UserRole: string
{
    case SuperAdmin = 'super_admin';
    case Admin = 'admin';
    case Moderator = 'moderator';
    case Scanner = 'scanner';

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super administrateur',
            self::Admin => 'Administrateur',
            self::Moderator => 'Modérateur',
            self::Scanner => 'Agent de contrôle',
        };
    }

    /** Peut lire le tableau de bord et les donnees de l'evenement. */
    public function canAccessBackOffice(): bool
    {
        return $this !== self::Scanner;
    }

    /** Peut creer, modifier ou supprimer des donnees metier. */
    public function canManage(): bool
    {
        return in_array($this, [self::SuperAdmin, self::Admin], true);
    }

    /** Peut valider ou rejeter une inscription. */
    public function canModerate(): bool
    {
        return in_array($this, [self::SuperAdmin, self::Admin, self::Moderator], true);
    }

    /** Peut scanner les billets a l'entree. */
    public function canScan(): bool
    {
        return in_array($this, [self::SuperAdmin, self::Admin, self::Scanner], true);
    }

    /** Reserve au super administrateur : comptes, tarifs, reglages sensibles. */
    public function canAdministrate(): bool
    {
        return $this === self::SuperAdmin;
    }
}
