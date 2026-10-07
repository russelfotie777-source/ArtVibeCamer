<?php

namespace App\Http\Requests;

use App\Enums\RegistrationType;
use App\Rules\CameroonPhone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;

class StoreRegistrationRequest extends FormRequest
{
    public function rules(): array
    {
        $groupe = $this->input('registration_type') === RegistrationType::Group->value;

        return [
            'category_id' => ['required', 'integer', Rule::exists('categories', 'id')->where('is_active', true)],

            'registration_type' => ['required', Rule::enum(RegistrationType::class)],

            /*
             * Meme en groupe, l'inscription a une personne responsable : c'est
             * elle que l'organisation appelle, et c'est son numero qui est
             * debite.
             */
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'stage_name' => ['nullable', 'string', 'max:100'],

            'group_name' => [
                $groupe ? 'required' : 'nullable',
                'string',
                'max:120',
            ],

            /*
             * L'email devient facultatif : beaucoup de candidats n'en ont pas,
             * et le telephone suffit a les joindre. L'unicite ne porte donc
             * que sur les adresses reellement fournies.
             */
            'email' => ['nullable', 'email:rfc', 'max:255', Rule::unique('candidates', 'email')->withoutTrashed()],

            // Le telephone reste la cle anti-doublon.
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

            /*
             * Membres du groupe. Le plafond exact depend de la categorie et
             * est verifie dans le service, qui la connait ; ici on borne
             * seulement l'absurde.
             */
            'members' => [$groupe ? 'required' : 'nullable', 'array', 'max:40'],
            'members.*.full_name' => ['required', 'string', 'max:120'],
            'members.*.photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],

            'payer_phone' => ['nullable', 'string', 'max:20', new CameroonPhone],

            'accepts_terms' => ['required', 'accepted'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(array_filter([
            'phone' => CameroonPhone::normalize($this->input('phone')),
            'whatsapp' => CameroonPhone::normalize($this->input('whatsapp')),
            'payer_phone' => CameroonPhone::normalize($this->input('payer_phone')),
            'email' => $this->filled('email') ? mb_strtolower(trim($this->input('email'))) : null,
            'registration_type' => $this->input('registration_type') ?: RegistrationType::Solo->value,
        ], fn ($v) => $v !== null));
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Une inscription existe déjà avec cette adresse email.',
            'phone.unique' => 'Une inscription existe déjà avec ce numéro de téléphone.',
            'accepts_terms.accepted' => 'Vous devez accepter le règlement du concours.',
            'group_name.required' => 'Donnez un nom à votre groupe.',
            'members.required' => 'Indiquez les membres de votre groupe.',
            'members.*.full_name.required' => 'Chaque membre doit être nommé.',
        ];
    }

    public function type(): RegistrationType
    {
        return RegistrationType::from($this->input('registration_type'));
    }

    /** Champs destines au modele Candidate, hors paiement et membres. */
    public function candidateData(): array
    {
        return $this->safe()->only([
            'first_name', 'last_name', 'stage_name', 'group_name', 'email', 'phone',
            'whatsapp', 'city', 'region', 'gender', 'date_of_birth', 'presentation',
            'socials',
        ]);
    }

    /** @return array<int, array{full_name: string, photo: ?UploadedFile}> */
    public function members(): array
    {
        if (! $this->type()->isGroup()) {
            return [];
        }

        $membres = [];

        foreach ((array) $this->input('members', []) as $i => $membre) {
            $nom = trim((string) ($membre['full_name'] ?? ''));

            if ($nom === '') {
                continue;
            }

            $membres[] = [
                'full_name' => $nom,
                'photo' => $this->file("members.{$i}.photo"),
            ];
        }

        return $membres;
    }
}
