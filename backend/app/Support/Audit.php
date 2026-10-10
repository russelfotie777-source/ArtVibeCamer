<?php

namespace App\Support;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Request;

/**
 * Journal des operations sensibles du back-office.
 *
 * Qui a valide quel candidat, qui a annule quels votes, qui a change un tarif.
 * Sur un evenement ou l'argent circule, pouvoir repondre a ces questions
 * apres coup vaut mieux que de devoir croire sur parole.
 */
class Audit
{
    public static function log(
        string $action,
        ?Model $subject = null,
        ?string $description = null,
        array $properties = [],
    ): void {
        ActivityLog::create([
            'user_id' => Request::user()?->id,
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'description' => $description,
            'properties' => $properties ?: null,
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
        ]);
    }
}
