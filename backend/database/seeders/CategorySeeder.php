<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Categories de depart. Tarifs entre 10 000 et 15 000 FCFA selon l'exigence
 * technique de la discipline, comme cadre par l'organisation.
 *
 * A ajuster depuis le back-office : ce seeder ne sert qu'a demarrer.
 */
class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Musique', 'fee' => 15000, 'vote' => 100, 'description' => 'Chant, instrument, composition : toutes les expressions musicales camerounaises.'],
            ['name' => 'Danse traditionnelle', 'fee' => 12500, 'vote' => 100, 'description' => 'Bikutsi, makossa, mbaya, assiko et répertoires régionaux.'],
            ['name' => 'Arts plastiques', 'fee' => 15000, 'vote' => 100, 'description' => 'Peinture, sculpture, dessin et installation.'],
            ['name' => 'Mode et design', 'fee' => 15000, 'vote' => 100, 'description' => 'Création textile, stylisme et valorisation des tissus locaux.'],
            ['name' => 'Humour', 'fee' => 10000, 'vote' => 100, 'description' => 'Stand-up et sketchs en français, anglais, pidgin ou langues nationales.'],
            ['name' => 'Slam et poésie', 'fee' => 10000, 'vote' => 100, 'description' => 'Écriture et déclamation.'],
            ['name' => 'Photographie', 'fee' => 12500, 'vote' => 100, 'description' => 'Reportage, portrait et photographie d\'art.'],
            ['name' => 'Arts culinaires', 'fee' => 12500, 'vote' => 100, 'description' => 'Patrimoine culinaire camerounais et cuisine revisitée.'],
        ];

        foreach ($categories as $index => $category) {
            Category::firstOrCreate(
                ['slug' => Str::slug($category['name'])],
                [
                    'name' => $category['name'],
                    'description' => $category['description'],
                    'registration_fee' => $category['fee'],
                    'vote_price' => $category['vote'],
                    'display_order' => $index,
                    'is_active' => true,
                ],
            );
        }
    }
}
