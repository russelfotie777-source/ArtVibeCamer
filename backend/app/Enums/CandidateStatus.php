<?php

namespace App\Enums;

enum CandidateStatus: string
{
    case Draft = 'draft';
    case AwaitingPayment = 'awaiting_payment';
    case PendingReview = 'pending_review';
    case Active = 'active';
    case Rejected = 'rejected';
    case Withdrawn = 'withdrawn';
    case Eliminated = 'eliminated';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Brouillon',
            self::AwaitingPayment => 'En attente de paiement',
            self::PendingReview => 'A valider',
            self::Active => 'Valide',
            self::Rejected => 'Rejete',
            self::Withdrawn => 'Retire',
            self::Eliminated => 'Elimine',
        };
    }

    /** Visible sur le site public. */
    public function isPubliclyVisible(): bool
    {
        return in_array($this, [self::Active, self::Eliminated], true);
    }

    /** Peut recevoir de nouveaux votes payants. */
    public function isVotable(): bool
    {
        return $this === self::Active;
    }
}
