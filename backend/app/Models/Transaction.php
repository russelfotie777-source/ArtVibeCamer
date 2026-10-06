<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use Database\Factories\TransactionFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Str;

class Transaction extends Model
{
    /** @use HasFactory<TransactionFactory> */
    use HasFactory;

    protected $fillable = [
        'reference',
        'type',
        'payable_type',
        'payable_id',
        'amount',
        'currency',
        'status',
        'provider',
        'provider_reference',
        'payment_method',
        'payer_name',
        'payer_phone',
        'payer_email',
        'idempotency_key',
        'expires_at',
        'metadata',
        'ip_address',
        'user_agent',
    ];

    protected $hidden = ['metadata'];

    protected function casts(): array
    {
        return [
            'type' => TransactionType::class,
            'status' => TransactionStatus::class,
            'payment_method' => PaymentMethod::class,
            'amount' => 'integer',
            'metadata' => 'array',
            'processing_at' => 'datetime',
            'paid_at' => 'datetime',
            'failed_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function payable(): MorphTo
    {
        return $this->morphTo();
    }

    public function webhooks()
    {
        return $this->hasMany(PaymentWebhook::class);
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }

    /**
     * Reference lisible et non devinable : AVC-VOT-2026-7F3K9A2B.
     * On evite un identifiant sequentiel pour ne pas divulguer le volume
     * de transactions de l'evenement.
     */
    public static function generateReference(TransactionType $type): string
    {
        do {
            $reference = sprintf(
                'AVC-%s-%s-%s',
                $type->referenceSegment(),
                now()->format('Y'),
                Str::upper(Str::random(8)),
            );
        } while (static::where('reference', $reference)->exists());

        return $reference;
    }

    // --- Scopes ------------------------------------------------------------

    public function scopeSucceeded(Builder $query): Builder
    {
        return $query->where('status', TransactionStatus::Succeeded->value);
    }

    public function scopeOfType(Builder $query, TransactionType $type): Builder
    {
        return $query->where('type', $type->value);
    }

    /** Transactions encore ouvertes dont le delai de paiement est depasse. */
    public function scopeStale(Builder $query): Builder
    {
        return $query->whereIn('status', [
            TransactionStatus::Pending->value,
            TransactionStatus::Processing->value,
        ])->whereNotNull('expires_at')->where('expires_at', '<', now());
    }

    // --- Etat --------------------------------------------------------------

    public function isSuccessful(): bool
    {
        return $this->status->isSuccessful();
    }

    public function isFinal(): bool
    {
        return $this->status->isFinal();
    }

    /** Montant formate pour affichage : 10 000 FCFA. */
    public function formattedAmount(): string
    {
        return number_format($this->amount, 0, ',', ' ').' FCFA';
    }

    /**
     * Fusionne sans ecraser : chaque etape du paiement ajoute sa trace
     * (demande, reponse passerelle, webhooks) dans le meme champ.
     */
    public function appendMetadata(array $data): void
    {
        $this->metadata = array_merge($this->metadata ?? [], $data);
    }
}
