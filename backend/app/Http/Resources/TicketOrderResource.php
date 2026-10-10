<?php

namespace App\Http\Resources;

use App\Models\TicketOrder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin TicketOrder */
class TicketOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'reference' => $this->reference,
            'buyer_name' => $this->buyer_name,
            'quantity' => $this->quantity,
            'total_amount' => $this->total_amount,
            'formatted_total' => $this->formattedTotal(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'ticket_type' => $item->type?->name,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'subtotal' => $item->subtotal,
            ])),
            'tickets' => TicketResource::collection($this->whenLoaded('tickets')),
            'transaction' => new TransactionResource($this->whenLoaded('transaction')),

            $this->mergeWhen($request->user()?->canAccessBackOffice(), fn () => [
                'id' => $this->id,
                'buyer_phone' => $this->buyer_phone,
                'buyer_email' => $this->buyer_email,
                'ip_address' => $this->ip_address,
            ]),
        ];
    }
}
