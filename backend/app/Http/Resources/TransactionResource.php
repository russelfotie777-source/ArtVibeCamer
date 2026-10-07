<?php

namespace App\Http\Resources;

use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Transaction */
class TransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'reference' => $this->reference,
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'amount' => $this->amount,
            'formatted_amount' => $this->formattedAmount(),
            'currency' => $this->currency,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'is_final' => $this->status->isFinal(),
            'is_awaiting_payer' => $this->status->isAwaitingPayer(),
            'payment_method' => $this->payment_method?->value,
            'payment_method_label' => $this->payment_method?->label(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'failure_reason' => $this->failure_reason,
            'created_at' => $this->created_at?->toIso8601String(),

            $this->mergeWhen($request->user()?->canAccessBackOffice(), fn () => [
                'id' => $this->id,
                'provider' => $this->provider,
                'provider_reference' => $this->provider_reference,
                'payer_name' => $this->payer_name,
                'payer_phone' => $this->payer_phone,
                'payer_email' => $this->payer_email,
                'ip_address' => $this->ip_address,
                'fees' => $this->fees,
                'net_amount' => $this->net_amount,
            ]),
        ];
    }
}
