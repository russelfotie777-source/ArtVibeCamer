<?php

namespace App\Models;

use App\Enums\CandidateStatus;
use Database\Factories\CandidateFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class Candidate extends Model
{
    /** @use HasFactory<CandidateFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'category_id',
        'first_name',
        'last_name',
        'stage_name',
        'email',
        'phone',
        'whatsapp',
        'city',
        'region',
        'gender',
        'date_of_birth',
        'photo_path',
        'presentation',
        'socials',
        'status',
        'is_featured',
        'ip_address',

        // Ecrits par le circuit de validation du back-office.
        'reviewed_by',
        'reviewed_at',
        'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'socials' => 'array',
            'date_of_birth' => 'date',
            'status' => CandidateStatus::class,
            'votes_count' => 'integer',
            'is_featured' => 'boolean',
            'reviewed_at' => 'datetime',
        ];
    }

    protected $appends = ['full_name', 'display_name', 'photo_url'];

    protected static function booted(): void
    {
        static::creating(function (self $candidate) {
            $candidate->slug ??= self::generateSlug(
                $candidate->stage_name ?: "{$candidate->first_name} {$candidate->last_name}"
            );
        });
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function registrationTransaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'registration_transaction_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function votes(): HasMany
    {
        return $this->hasMany(Vote::class);
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    // --- Accesseurs ---------------------------------------------------------

    public function getFullNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    /** Nom de scene s'il existe, sinon etat civil. */
    public function getDisplayNameAttribute(): string
    {
        return $this->stage_name ?: $this->full_name;
    }

    public function getPhotoUrlAttribute(): ?string
    {
        return $this->photo_path ? Storage::disk('public')->url($this->photo_path) : null;
    }

    // --- Scopes ------------------------------------------------------------

    public function scopeVisible(Builder $query): Builder
    {
        return $query->whereIn('status', [
            CandidateStatus::Active->value,
            CandidateStatus::Eliminated->value,
        ]);
    }

    public function scopeVotable(Builder $query): Builder
    {
        return $query->where('status', CandidateStatus::Active->value);
    }

    public function scopeInCategory(Builder $query, Category|int $category): Builder
    {
        return $query->where('category_id', $category instanceof Category ? $category->id : $category);
    }

    /** Classement par voix, le numero de candidat tranchant les egalites. */
    public function scopeRanked(Builder $query): Builder
    {
        return $query->orderByDesc('votes_count')->orderBy('candidate_number');
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (blank($term)) {
            return $query;
        }

        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';

        return $query->where(function (Builder $q) use ($like) {
            $q->where('first_name', 'like', $like)
                ->orWhere('last_name', 'like', $like)
                ->orWhere('stage_name', 'like', $like)
                ->orWhere('candidate_number', 'like', $like)
                ->orWhere('phone', 'like', $like)
                ->orWhere('email', 'like', $like);
        });
    }

    // --- Etat --------------------------------------------------------------

    public function isVotable(): bool
    {
        return $this->status->isVotable();
    }

    public function hasPaidRegistration(): bool
    {
        return $this->registration_transaction_id !== null
            && $this->registrationTransaction?->status->isSuccessful() === true;
    }

    /**
     * Rang du candidat dans sa categorie. Calcule a la demande : on ne stocke
     * pas une position qui changerait a chaque vote encaisse.
     */
    public function rank(): int
    {
        return 1 + static::query()
            ->inCategory($this->category_id)
            ->visible()
            ->where('votes_count', '>', $this->votes_count)
            ->count();
    }

    private static function generateSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'candidat';
        $slug = $base;
        $i = 2;

        while (static::withTrashed()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }
}
