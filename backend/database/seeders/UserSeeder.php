<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        /*
         * En local, un compte de travail avec un mot de passe connu.
         * Hors local, le mot de passe est tire au hasard et affiche une seule
         * fois : aucun identifiant par defaut ne doit survivre a la mise en
         * ligne, c'est la premiere porte qu'on essaie sur un back-office.
         */
        $isLocal = app()->environment('local');
        $password = $isLocal ? 'password' : Str::password(16);

        $user = User::firstOrCreate(
            ['email' => 'admin@artvibecamer.cm'],
            [
                'name' => 'Administrateur',
                'password' => $password,
                'role' => UserRole::SuperAdmin,
                'is_active' => true,
                'email_verified_at' => now(),
            ],
        );

        if ($user->wasRecentlyCreated) {
            $this->command->newLine();
            $this->command->info('Compte super administrateur cree');
            $this->command->line('  Email    : '.$user->email);
            $this->command->line('  Mot de passe : '.$password);

            if (! $isLocal) {
                $this->command->warn('  Notez-le maintenant : il ne sera plus affiche.');
            }
            $this->command->newLine();
        }
    }
}
