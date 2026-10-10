<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

use function Laravel\Prompts\password;
use function Laravel\Prompts\select;
use function Laravel\Prompts\text;

/**
 * Creation d'un compte d'equipe.
 *
 * Passe par la ligne de commande et non par une page d'inscription : il n'y a
 * aucune raison qu'un back-office qui donne acces aux recettes et aux donnees
 * personnelles expose un formulaire de creation de compte sur internet.
 */
class CreateBackOfficeUser extends Command
{
    protected $signature = 'user:create
                            {--name= : Nom affiche}
                            {--email= : Adresse de connexion}
                            {--role= : super_admin, admin, moderator ou scanner}';

    protected $description = 'Cree un compte pour le back-office ou le controle d\'acces';

    public function handle(): int
    {
        $name = $this->option('name') ?: text('Nom', required: true);
        $email = $this->option('email') ?: text('Email', required: true);

        $role = $this->option('role') ?: select(
            label: 'Role',
            options: collect(UserRole::cases())
                ->mapWithKeys(fn (UserRole $r) => [$r->value => $r->label()])
                ->all(),
            default: UserRole::Admin->value,
        );

        $validator = Validator::make(
            ['name' => $name, 'email' => mb_strtolower(trim($email)), 'role' => $role],
            [
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'unique:users,email'],
                'role' => ['required', 'in:'.implode(',', array_column(UserRole::cases(), 'value'))],
            ],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $data = $validator->validated();

        // Mot de passe saisi, ou genere puis affiche une seule fois.
        $plain = $this->option('name') === null && $this->input->isInteractive()
            ? password('Mot de passe (laisser vide pour en generer un)', required: false)
            : null;

        $generated = blank($plain);
        $plain = $generated ? Str::password(16) : $plain;

        if (! $generated && mb_strlen($plain) < 10) {
            $this->error('Le mot de passe doit comporter au moins 10 caracteres.');

            return self::FAILURE;
        }

        $user = User::create([
            ...$data,
            'password' => $plain,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        $this->newLine();
        $this->info('Compte cree');
        $this->line('  Email : '.$user->email);
        $this->line('  Role  : '.$user->role->label());

        if ($generated) {
            $this->line('  Mot de passe : '.$plain);
            $this->warn('  Notez-le maintenant : il ne sera plus affiche.');
        }

        return self::SUCCESS;
    }
}
