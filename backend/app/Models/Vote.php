<?php

namespace App\Models;

use App\Enums\VoteStatus;
use Database\Factories\VoteFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Vote extends Model
{
    /** @use HasFactory<VoteFactory> */
    use HasFactory;

    protected $fillable = [
        'reference',
        'candidate_id',
        'category_id',
        'transaction_id',
        'quantity',
        'unit_price',
        'total_amount',
        'voter_name',
        'voter_phone',
        'voter_email',
        'status',
        'ip_address',
        'user_agent',
        'fingerprint',

        // Ecrits a la confirmation du paiement et a l'annulation d'un lot.
        'confirmed_at',
        'cancelled_by',
        'cancelled_at',
        'cancellation_reason',
    ];

    protected function casts(): array
    {
        return [
            'status' => VoteStatus::class,
            'quantity' => 'integer',
            'unit_price' => 'integer',
            'total_amount' => 'integer',
            'confirmed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }

    public static function generateReference(): string
    {
        do {
            $reference = 'AVC-V-'.Str::upper(Str::random(10));
        } while (static::where('reference', $reference)->exists());

        return $reference;
    }

    public function scopeConfirmed(Builder $query): Builder
    {
        return $query->where('status', VoteStatus::Confirmed->value);
    }

    public function scopeForCandidate(Builder $query, Candidate|int $candidate): Builder
    {
        return $query->where('candidate_id', $candidate instanceof Candidate ? $candidate->id : $candidate);
    }

    public function isConfirmed(): bool
    {
        return $this->status === VoteStatus::Confirmed;
    }
}
