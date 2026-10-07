<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Les quatre categories du concours.
 *
 * Tarifs : 8 000 FCFA en individuel, 10 000 FCFA en groupe. Miss & Master
 * fait exception — le concours y est par nature individuel, l'inscription est
 * a 10 000 FCFA et group_fee reste a NULL, ce qui ferme la formule groupe.
 *
 * Les montants et les fenetres d'inscription se modifient ensuite depuis le
 * back-office : ce seeder ne sert qu'a demarrer.
 */
class CategorySeeder extends Seeder
{
    public function run(): void
    {
        // Les inscriptions annoncees courent jusqu'au 30 octobre.
        $cloture = Carbon::parse('2026-10-30 23:59:59', 'Africa/Douala');

        $categories = [
            [
                'name' => 'Danse',
                'tagline' => 'Ton rythme, ton talent, ta scène',
                'description' => 'Danse urbaine, traditionnelle ou contemporaine. En solo ou en formation.',
                'solo' => 8000,
                'groupe' => 10000,
                'max_membres' => 15,
            ],
            [
                'name' => 'Chant',
                'tagline' => 'Ta voix, ton talent, ta scène',
                'description' => 'Chanteurs et chanteuses, talents émergents, artistes passionnés.',
                'solo' => 8000,
                'groupe' => 10000,
                'max_membres' => 10,
            ],
            [
                'name' => 'Comédie',
                'tagline' => 'Ton humour, ton talent, ta scène',
                'description' => 'Humoristes, comédiens, créateurs de sketchs. Seul ou en troupe.',
                'solo' => 8000,
                'groupe' => 10000,
                'max_membres' => 8,
            ],
            [
                'name' => 'Miss & Master',
                'tagline' => 'Ton élégance, ta personnalité, ta couronne',
                'description' => 'Élégance, charisme et aisance sur scène. Concours individuel.',
                'solo' => 10000,
                'groupe' => null,
                'max_membres' => 0,
            ],
        ];

        foreach ($categories as $index => $c) {
            Category::updateOrCreate(
                ['slug' => Str::slug($c['name'])],
                [
                    'name' => $c['name'],
                    'tagline' => $c['tagline'],
                    'description' => $c['description'],
                    'registration_fee' => $c['solo'],
                    'group_fee' => $c['groupe'],
                    'max_group_members' => $c['max_membres'],
                    'vote_price' => 100,
                    'registration_closes_at' => $cloture,
                    'display_order' => $index,
                    'is_active' => true,
                ],
            );
        }
    }
}
