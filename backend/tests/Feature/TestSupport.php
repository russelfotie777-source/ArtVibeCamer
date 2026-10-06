<?php

namespace Tests\Feature;

use App\Enums\CandidateStatus;
use App\Enums\UserRole;
use App\Models\Candidate;
use App\Models\Category;
use App\Models\TicketType;
use App\Models\User;
use Database\Seeders\SettingSeeder;

/**
 * Fabriques minimales partagees par les tests.
 *
 * Volontairement sans factories Eloquent : ces tests portent sur des
 * invariants d'argent, on veut des donnees explicites et lisibles dans le
 * test lui-meme plutot que derriere un faker.
 */
trait TestSupport
{
    protected function seedSettings(): void
    {
        $this->seed(SettingSeeder::class);
    }

    protected function makeCategory(array $attributes = []): Category
    {
        return Category::create([
            'name' => $attributes['name'] ?? 'Musique',
            'registration_fee' => 15000,
            'vote_price' => 100,
            'is_active' => true,
            ...$attributes,
        ]);
    }

    protected function makeCandidate(Category $category, array $attributes = []): Candidate
    {
        /*
         * candidate_number et votes_count ne sont volontairement pas
         * mass-assignables : seuls le fulfilment d'un paiement confirme et
         * les increments de vote y touchent. Les tests qui ont besoin de les
         * poser passent donc par forceFill, sans affaiblir le modele.
         */
        $guarded = array_intersect_key($attributes, array_flip([
            'candidate_number', 'votes_count', 'registration_transaction_id',
        ]));

        $candidate = Candidate::create([
            'category_id' => $category->id,
            'first_name' => 'Arnaud',
            'last_name' => 'Nkolo',
            'stage_name' => 'Arno Vibe',
            'email' => 'arnaud@example.cm',
            'phone' => '237671234567',
            'status' => CandidateStatus::Active,
            ...array_diff_key($attributes, $guarded),
        ]);

        if ($guarded !== []) {
            $candidate->forceFill($guarded)->save();
        }

        return $candidate;
    }

    protected function makeTicketType(array $attributes = []): TicketType
    {
        return TicketType::create([
            'name' => $attributes['name'] ?? 'Standard',
            'price' => 5000,
            'quantity_total' => 100,
            'max_per_order' => 10,
            'is_active' => true,
            ...$attributes,
        ]);
    }

    protected function makeUser(UserRole $role = UserRole::SuperAdmin): User
    {
        return User::create([
            'name' => 'Agent '.$role->value,
            'email' => $role->value.'@artvibecamer.test',
            'password' => 'password-de-test',
            'role' => $role,
            'is_active' => true,
        ]);
    }
}
