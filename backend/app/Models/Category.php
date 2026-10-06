<?php

namespace App\Models;

use App\Enums\CandidateStatus;
use Database\Factories\CategoryFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class Category extends Model
{
    /** @use HasFactory<CategoryFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'cover_image',
        'registration_fee',
        'vote_price',
        'max_candidates',
        'registration_opens_at',
        'registration_closes_at',
        'voting_opens_at',
        'voting_closes_at',
        'is_active',
        'display_order',
    ];

    protected function casts(): array
    {
        return [
            'registration_fee' => 'integer',
            'vote_price' => 'integer',
            'max_candidates' => 'integer',
            'candidates_count' => 'integer',
            'votes_count' => 'integer',
            'registration_opens_at' => 'datetime',
            'registration_closes_at' => 'datetime',
            'voting_opens_at' => 'datetime',
            'voting_closes_at' => 'datetime',
            'is_active' => 'boolean',
            'display_order' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $category) {
            $category->slug ??= Str::slug($category->name);
        });
    }

    public function candidates(): HasMany
    {
        return $this->hasMany(Candidate::class);
    }

    public function votes(): HasMany
    {
        return $this->hasMany(Vote::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('display_order')->orderBy('name');
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * Code court derive du nom, utilise dans les numeros de candidat
     * (Musique -> MUS, donc AVC-MUS-014).
     */
    public function code(): string
    {
        return Str::upper(Str::substr(Str::ascii($this->name), 0, 3));
    }

    public function isRegistrationOpen(?Carbon $at = null): bool
    {
        if (! $this->is_active || ! Setting::get('registration_enabled', true)) {
            return false;
        }

        if ($this->isFull()) {
            return false;
        }

        return $this->withinWindow(
            $at ?? now(),
            $this->registration_opens_at,
            $this->registration_closes_at,
        );
    }

    public function isVotingOpen(?Carbon $at = null): bool
    {
        if (! $this->is_active || ! Setting::get('voting_enabled', true)) {
            return false;
        }

        return $this->withinWindow(
            $at ?? now(),
            $this->voting_opens_at,
            $this->voting_closes_at,
        );
    }

    public function isFull(): bool
    {
        return $this->max_candidates !== null
            && $this->candidates_count >= $this->max_candidates;
    }

    /** Nombre de candidats reellement visibles au public. */
    public function publicCandidatesCount(): int
    {
        return $this->candidates()
            ->whereIn('status', [CandidateStatus::Active->value, CandidateStatus::Eliminated->value])
            ->count();
    }

    /** Une borne NULL signifie "pas de limite de ce cote". */
    private function withinWindow(Carbon $at, ?Carbon $from, ?Carbon $to): bool
    {
        if ($from !== null && $at->lt($from)) {
            return false;
        }

        return ! ($to !== null && $at->gt($to));
    }
}
