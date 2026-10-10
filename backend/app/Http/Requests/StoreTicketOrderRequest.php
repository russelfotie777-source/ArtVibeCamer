<?php

namespace App\Http\Requests;

use App\Rules\CameroonPhone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTicketOrderRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1', 'max:10'],
            'items.*.ticket_type_id' => [
                'required',
                'integer',
                Rule::exists('ticket_types', 'id')->where('is_active', true),
            ],
            // Le plafond reel par categorie de place est verifie dans le
            // service, qui connait la jauge restante sous verrou.
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:50'],

            'buyer_name' => ['required', 'string', 'max:120'],
            'buyer_phone' => ['required', 'string', 'max:20', new CameroonPhone],
            'buyer_email' => ['nullable', 'email:rfc', 'max:255'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('buyer_phone')) {
            $this->merge(['buyer_phone' => CameroonPhone::normalize($this->input('buyer_phone'))]);
        }
    }

    public function messages(): array
    {
        return [
            'items.required' => 'Sélectionnez au moins un billet.',
            'buyer_phone.required' => 'Le numéro Mobile Money est nécessaire pour encaisser la commande.',
        ];
    }
}
