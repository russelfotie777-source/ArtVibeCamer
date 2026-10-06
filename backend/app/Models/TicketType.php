<?php

namespace App\Models;

use Database\Factories\TicketTypeFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class TicketType extends Model
{
    /** @use HasFactory<TicketTypeFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'price',
        'quantity_total',
        'max_per_order',
        'sales_opens_at',
        'sales_closes_at',
        'is_active',
        'display_order',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'quantity_total' => 'integer',
            'quantity_sold' => 'integer',
            'quantity_reserved' => 'integer',
            'max_per_order' => 'integer',
            'sales_opens_at' => 'datetime',
            'sales_closes_at' => 'datetime',
            'is_active' => 'boolean',
            'display_order' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $type) {
            $type->slug ??= Str::slug($type->name);
        });
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('display_order')->orderBy('price');
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /** NULL = jauge illimitee. */
    public function isUnlimited(): bool
    {
        return $this->quantity_total === null;
    }

    /**
     * Places encore vendables. Les places reservees (paiement en cours) sont
     * retirees du disponible pour eviter la survente.
     */
    public function availableQuantity(): ?int
    {
        if ($this->isUnlimited()) {
            return null;
        }

        return max(0, $this->quantity_total - $this->quantity_sold - $this->quantity_reserved);
    }

    public function isSoldOut(): bool
    {
        return ! $this->isUnlimited() && $this->availableQuantity() === 0;
    }

    public function isOnSale(?Carbon $at = null): bool
    {
        if (! $this->is_active || ! Setting::get('ticketing_enabled', true) || $this->isSoldOut()) {
            return false;
        }

        $at ??= now();

        if ($this->sales_opens_at !== null && $at->lt($this->sales_opens_at)) {
            return false;
        }

        return ! ($this->sales_closes_at !== null && $at->gt($this->sales_closes_at));
    }

    /** Plafond reel d'une commande : min(limite par commande, stock restant). */
    public function maxPurchasable(): int
    {
        $available = $this->availableQuantity();

        return $available === null
            ? $this->max_per_order
            : min($this->max_per_order, $available);
    }
}
