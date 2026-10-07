<?php

namespace App\Http\Requests;

use App\Rules\CameroonPhone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRegistrationRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'category_id' => ['required', 'integer', Rule::exists('categories', 'id')->where('is_active', true)],

            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'stage_name' => ['nullable', 'string', 'max:100'],

            // Unicite verifiee en base ET par un index unique : la contrainte
            // SQL est le vrai garde-fou contre deux soumissions simultanees.
            'email' => ['required', 'email:rfc,dns', 'max:255', Rule::unique('candidates', 'email')->withoutTrashed()],
            'phone' => ['required', 'string', 'max:20', new CameroonPhone, Rule::unique('candidates', 'phone')->withoutTrashed()],
            'whatsapp' => ['nullable', 'string', 'max:20', new CameroonPhone],

            'city' => ['nullable', 'string', 'max:100'],
            'region' => ['nullable', 'string', 'max:100'],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'date_of_birth' => ['nullable', 'date', 'before:today', 'after:1920-01-01'],

            'presentation' => ['nullable', 'string', 'max:2000'],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],

            'socials' => ['nullable', 'array'],
            'socials.facebook' => ['nullable', 'url', 'max:255'],
            'socials.instagram' => ['nullable', 'url', 'max:255'],
            'socials.tiktok' => ['nullable', 'url', 'max:255'],
            'socials.youtube' => ['nullable', 'url', 'max:255'],

            // Le numero qui sera debite, s'il differe du numero de contact.
            'payer_phone' => ['nullable', 'string', 'max:20', new CameroonPhone],

            'accepts_terms' => ['required', 'accepted'],
        ];
    }

    /** Numeros ramenes a la forme 237XXXXXXXXX avant validation d'unicite. */
    protected function prepareForValidation(): void
    {
        $this->merge(array_filter([
            'phone' => CameroonPhone::normalize($this->input('phone')),
            'whatsapp' => CameroonPhone::normalize($this->input('whatsapp')),
            'payer_phone' => CameroonPhone::normalize($this->input('payer_phone')),
            'email' => $this->filled('email') ? mb_strtolower(trim($this->input('email'))) : null,
        ], fn ($v) => $v !== null));
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Une inscription existe déjà avec cette adresse email.',
            'phone.unique' => 'Une inscription existe déjà avec ce numéro de téléphone.',
            'accepts_terms.accepted' => 'Vous devez accepter le règlement du concours.',
        ];
    }

    /** Champs destines au modele Candidate, hors metadonnees de paiement. */
    public function candidateData(): array
    {
        return $this->safe()->only([
            'first_name', 'last_name', 'stage_name', 'email', 'phone', 'whatsapp',
            'city', 'region', 'gender', 'date_of_birth', 'presentation', 'socials',
        ]);
    }
}
