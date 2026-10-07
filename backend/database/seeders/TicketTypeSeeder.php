<?php

namespace Database\Seeders;

use App\Models\TicketType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class TicketTypeSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            [
                'name' => 'Standard',
                'description' => 'Accès à la salle, placement libre.',
                'price' => 5000,
                'quantity_total' => 1000,
                'max_per_order' => 10,
            ],
            [
                'name' => 'VIP',
                'description' => 'Placement réservé près de la scène et collation.',
                'price' => 15000,
                'quantity_total' => 200,
                'max_per_order' => 6,
            ],
            [
                'name' => 'VVIP',
                'description' => 'Table nominative, service dédié et accès au cocktail d\'après-spectacle.',
                'price' => 50000,
                'quantity_total' => 40,
                'max_per_order' => 4,
            ],
        ];

        foreach ($types as $index => $type) {
            TicketType::firstOrCreate(
                ['slug' => Str::slug($type['name'])],
                [...$type, 'display_order' => $index, 'is_active' => true],
            );
        }
    }
}
