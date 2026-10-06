<?php

namespace App\Http\Resources;

use App\Models\Vote;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Vote */
class VoteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'reference' => $this->reference,
            'quantity' => $this->quantity,
            'unit_price' => $this->unit_price,
            'total_amount' => $this->total_amount,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'confirmed_at' => $this->confirmed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'candidate' => new CandidateResource($this->whenLoaded('candidate')),
            'transaction' => new TransactionResource($this->whenLoaded('transaction')),

            $this->mergeWhen($request->user()?->canAccessBackOffice(), fn () => [
                'id' => $this->id,
                'voter_name' => $this->voter_name,
                'voter_phone' => $this->voter_phone,
                'voter_email' => $this->voter_email,
                'ip_address' => $this->ip_address,
                'fingerprint' => $this->fingerprint,
                'cancellation_reason' => $this->cancellation_reason,
                'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            ]),
        ];
    }
}
