<?php

namespace App\Models;

use App\Enums\TicketStatus;
use Database\Factories\TicketFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Ticket extends Model
{
    /** @use HasFactory<TicketFactory> */
    use HasFactory;

    protected $fillable = [
        'ticket_order_id',
        'ticket_type_id',
        'code',
        'qr_token',
        'holder_name',
        'status',
    ];

    /** Le jeton du QR vaut droit d'entree : jamais serialise vers le public. */
    protected $hidden = ['qr_token'];

    protected function casts(): array
    {
        return [
            'status' => TicketStatus::class,
            'scan_count' => 'integer',
            'used_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(TicketOrder::class, 'ticket_order_id');
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(TicketType::class, 'ticket_type_id');
    }

    public function scanner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'used_by');
    }

    public function scanLogs(): HasMany
    {
        return $this->hasMany(ScanLog::class);
    }

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    /**
     * Code court dictable par telephone si le QR est illisible.
     * Alphabet sans 0/O/1/I/L pour eviter les confusions a l'oral.
     */
    public static function generateCode(): string
    {
        $alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

        do {
            $suffix = '';
            for ($i = 0; $i < 6; $i++) {
                $suffix .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            $code = "AVC-T-{$suffix}";
        } while (static::where('code', $code)->exists());

        return $code;
    }

    /**
     * Charge utile du QR : 256 bits aleatoires, ni sequentiels ni derives
     * d'une donnee metier, donc non forgeables.
     */
    public static function generateQrToken(): string
    {
        do {
            $token = Str::random(64);
        } while (static::where('qr_token', $token)->exists());

        return $token;
    }

    public function scopeValid(Builder $query): Builder
    {
        return $query->where('status', TicketStatus::Valid->value);
    }

    public function isValid(): bool
    {
        return $this->status === TicketStatus::Valid;
    }

    public function isUsed(): bool
    {
        return $this->status === TicketStatus::Used;
    }
}
