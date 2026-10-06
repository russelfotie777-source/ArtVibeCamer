<?php

namespace App\Models;

use App\Enums\TicketOrderStatus;
use Database\Factories\TicketOrderFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class TicketOrder extends Model
{
    /** @use HasFactory<TicketOrderFactory> */
    use HasFactory;

    protected $fillable = [
        'reference',
        'transaction_id',
        'buyer_name',
        'buyer_phone',
        'buyer_email',
        'quantity',
        'total_amount',
        'status',
        'paid_at',
        'expires_at',
        'delivered_at',
        'delivery_channel',
        'ip_address',
    ];

    protected function casts(): array
    {
        return [
            'status' => TicketOrderStatus::class,
            'quantity' => 'integer',
            'total_amount' => 'integer',
            'paid_at' => 'datetime',
            'expires_at' => 'datetime',
            'delivered_at' => 'datetime',
        ];
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }

    /** Lignes commandees : ce qui doit etre emis une fois le paiement confirme. */
    public function items(): HasMany
    {
        return $this->hasMany(TicketOrderItem::class);
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }

    public static function generateReference(): string
    {
        do {
            $reference = 'AVC-C-'.Str::upper(Str::random(10));
        } while (static::where('reference', $reference)->exists());

        return $reference;
    }

    public function scopePaid(Builder $query): Builder
    {
        return $query->where('status', TicketOrderStatus::Paid->value);
    }

    /** Commandes impayees dont le delai de reservation est ecoule. */
    public function scopeStale(Builder $query): Builder
    {
        return $query->where('status', TicketOrderStatus::Pending->value)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now());
    }

    public function isPaid(): bool
    {
        return $this->status === TicketOrderStatus::Paid;
    }

    public function formattedTotal(): string
    {
        return number_format($this->total_amount, 0, ',', ' ').' FCFA';
    }
}
