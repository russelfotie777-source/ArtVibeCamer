<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Ordre impose : les reglages sont lus par les modeles (ouverture des
        // inscriptions, des votes, de la billetterie).
        $this->call([
            SettingSeeder::class,
            UserSeeder::class,
            CategorySeeder::class,
            TicketTypeSeeder::class,
        ]);
    }
}
