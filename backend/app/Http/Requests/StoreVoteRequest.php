<?php

namespace App\Http\Requests;

use App\Rules\CameroonPhone;
use Illuminate\Foundation\Http\FormRequest;

class StoreVoteRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            // Le montant n'est jamais accepte depuis le client : seule la
            // quantite est saisie, le prix vient de la categorie.
            'quantity' => [
                'required',
                'integer',
                'min:'.config('payments.votes.min_quantity'),
                'max:'.config('payments.votes.max_quantity'),
            ],
            'voter_name' => ['nullable', 'string', 'max:120'],
            'voter_phone' => ['required', 'string', 'max:20', new CameroonPhone],
            'voter_email' => ['nullable', 'email:rfc', 'max:255'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('voter_phone')) {
            $this->merge(['voter_phone' => CameroonPhone::normalize($this->input('voter_phone'))]);
        }
    }

    public function messages(): array
    {
        return [
            'quantity.min' => 'Vous devez acheter au moins un vote.',
            'quantity.max' => 'Le nombre de votes par achat est limité à :max.',
            'voter_phone.required' => 'Le numéro Mobile Money est nécessaire pour encaisser le vote.',
        ];
    }
}
