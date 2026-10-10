<?php

namespace App\Models;

use App\Enums\ScanResult;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScanLog extends Model
{
    protected $fillable = [
        'ticket_id',
        'raw_code',
        'result',
        'scanned_by',
        'gate',
        'ip_address',
        'user_agent',
        'scanned_at',
    ];

    protected function casts(): array
    {
        return [
            'result' => ScanResult::class,
            'scanned_at' => 'datetime',
        ];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function scanner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'scanned_by');
    }

    public function scopeAccepted(Builder $query): Builder
    {
        return $query->where('result', ScanResult::Accepted->value);
    }

    /** Tentatives refusees : utile pour reperer une fraude a l'entree. */
    public function scopeRejected(Builder $query): Builder
    {
        return $query->where('result', '!=', ScanResult::Accepted->value);
    }
}
