<?php

namespace App\Http\Resources;

use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Ticket */
class TicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'code' => $this->code,
            'holder_name' => $this->holder_name,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'type' => new TicketTypeResource($this->whenLoaded('type')),
            'used_at' => $this->used_at?->toIso8601String(),

            /*
             * Le jeton du QR vaut droit d'entree. Il n'est renvoye qu'au
             * porteur du billet, qui doit connaitre la reference de commande
             * pour y acceder, ou a l'equipe.
             */
            'qr_token' => $this->when(
                $request->attributes->get('expose_qr', false)
                    || $request->user()?->canAccessBackOffice(),
                fn () => $this->qr_token,
            ),

            $this->mergeWhen($request->user()?->canAccessBackOffice(), fn () => [
                'id' => $this->id,
                'scan_count' => $this->scan_count,
            ]),
        ];
    }
}
