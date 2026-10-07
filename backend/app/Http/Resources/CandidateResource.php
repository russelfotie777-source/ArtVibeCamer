<?php

namespace App\Http\Resources;

use App\Models\Candidate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Candidate */
class CandidateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isStaff = $request->user()?->canAccessBackOffice() === true;

        return [
            'id' => $this->id,
            'candidate_number' => $this->candidate_number,
            'slug' => $this->slug,
            'display_name' => $this->display_name,
            'stage_name' => $this->stage_name,
            'registration_type' => $this->registration_type->value,
            'registration_type_label' => $this->registration_type->label(),
            'is_group' => $this->isGroup(),
            'group_name' => $this->group_name,
            'members_count' => $this->members_count,

            /*
             * Les membres d'un groupe sont la composition de l'acte presente
             * au public : leurs noms et photos ont vocation a etre vus, au
             * contraire des coordonnees du responsable.
             */
            'members' => $this->whenLoaded('members', fn () => $this->members->map(fn ($m) => [
                'full_name' => $m->full_name,
                'photo_url' => $m->photo_url,
            ])),
            'photo_url' => $this->photo_url,
            'presentation' => $this->presentation,
            'city' => $this->city,
            'region' => $this->region,
            'socials' => $this->socials,
            'votes_count' => $this->votes_count,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'is_votable' => $this->isVotable(),
            'is_featured' => $this->is_featured,
            'category' => new CategoryResource($this->whenLoaded('category')),

            /*
             * Donnees personnelles : nom civil, telephone, email et adresse IP
             * ne sortent jamais vers le public. Un candidat n'est identifie
             * publiquement que par son nom de scene et son numero.
             */
            $this->mergeWhen($isStaff, fn () => [
                'first_name' => $this->first_name,
                'last_name' => $this->last_name,
                'full_name' => $this->full_name,
                'email' => $this->email,
                'phone' => $this->phone,
                'whatsapp' => $this->whatsapp,
                'gender' => $this->gender,
                'date_of_birth' => $this->date_of_birth?->toDateString(),
                'has_paid_registration' => $this->candidate_number !== null,
                'rejection_reason' => $this->rejection_reason,
                'reviewed_at' => $this->reviewed_at?->toIso8601String(),
                'ip_address' => $this->ip_address,
                'created_at' => $this->created_at?->toIso8601String(),
                'reviewer' => $this->whenLoaded('reviewer', fn () => $this->reviewer?->name),
                'registration_transaction' => new TransactionResource(
                    $this->whenLoaded('registrationTransaction')
                ),
            ]),
        ];
    }
}
