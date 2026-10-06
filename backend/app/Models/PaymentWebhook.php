<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentWebhook extends Model
{
    protected $fillable = [
        'provider',
        'event_id',
        'provider_reference',
        'signature_valid',
        'headers',
        'payload',
        'transaction_id',
        'ip_address',
    ];

    protected function casts(): array
    {
        return [
            'headers' => 'array',
            'payload' => 'array',
            'signature_valid' => 'boolean',
            'processed_at' => 'datetime',
            'attempts' => 'integer',
        ];
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function scopeUnprocessed(Builder $query): Builder
    {
        return $query->whereNull('processed_at');
    }

    public function scopeFailed(Builder $query): Builder
    {
        return $query->whereNull('processed_at')->whereNotNull('error');
    }

    public function markProcessed(): void
    {
        $this->forceFill(['processed_at' => now(), 'error' => null])->save();
    }

    public function markFailed(string $error): void
    {
        $this->forceFill([
            'error' => $error,
            'attempts' => $this->attempts + 1,
        ])->save();
    }
}
