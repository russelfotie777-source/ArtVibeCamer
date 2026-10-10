<?php

namespace App\Http\Resources;

use App\Models\TicketType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin TicketType */
class TicketTypeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'price' => $this->price,
            'is_on_sale' => $this->isOnSale(),
            'is_sold_out' => $this->isSoldOut(),
            'max_purchasable' => $this->maxPurchasable(),
            'display_order' => $this->display_order,

            /*
             * La jauge restante n'est pas publiee telle quelle : afficher
             * "il reste 3 places" se prete a la pression commerciale mais
             * expose aussi le volume de ventes de l'evenement.
             */
            $this->mergeWhen($request->user()?->canAccessBackOffice(), fn () => [
                'quantity_total' => $this->quantity_total,
                'quantity_sold' => $this->quantity_sold,
                'quantity_reserved' => $this->quantity_reserved,
                'available_quantity' => $this->availableQuantity(),
                'is_active' => $this->is_active,
                'sales_opens_at' => $this->sales_opens_at?->toIso8601String(),
                'sales_closes_at' => $this->sales_closes_at?->toIso8601String(),
            ]),
        ];
    }
}
