<?php

namespace App\Http\Resources;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Category */
class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'cover_image' => $this->cover_image,
            'registration_fee' => $this->registration_fee,
            'vote_price' => $this->vote_price,
            'candidates_count' => $this->candidates_count,
            'votes_count' => $this->votes_count,
            'max_candidates' => $this->max_candidates,
            'is_registration_open' => $this->isRegistrationOpen(),
            'is_voting_open' => $this->isVotingOpen(),
            'is_full' => $this->isFull(),
            'registration_closes_at' => $this->registration_closes_at?->toIso8601String(),
            'voting_closes_at' => $this->voting_closes_at?->toIso8601String(),
            'display_order' => $this->display_order,
            'candidates' => CandidateResource::collection($this->whenLoaded('candidates')),

            // Reservees au back-office.
            $this->mergeWhen($request->user()?->canAccessBackOffice(), fn () => [
                'is_active' => $this->is_active,
                'registration_opens_at' => $this->registration_opens_at?->toIso8601String(),
                'voting_opens_at' => $this->voting_opens_at?->toIso8601String(),
                'created_at' => $this->created_at?->toIso8601String(),
            ]),
        ];
    }
}
