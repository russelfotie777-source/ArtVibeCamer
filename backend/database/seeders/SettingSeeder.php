<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->settings() as $setting) {
            // updateOrCreate : le seeder peut etre rejoue sans ecraser les
            // reglages ajustes par l'equipe depuis le back-office.
            Setting::firstOrCreate(['key' => $setting['key']], $setting);
        }
    }

    private function settings(): array
    {
        return [
            // --- Identite de l'evenement (exposee au front) ---
            ['key' => 'event_name', 'value' => 'ArtVibeCamer', 'type' => 'string', 'group' => 'event', 'label' => 'Nom de l\'evenement', 'is_public' => true],
            ['key' => 'event_tagline', 'value' => 'La culture, les talents et l\'art camerounais sur une seule scene', 'type' => 'string', 'group' => 'event', 'label' => 'Accroche', 'is_public' => true],
            ['key' => 'event_date', 'value' => null, 'type' => 'datetime', 'group' => 'event', 'label' => 'Date de l\'evenement', 'is_public' => true],
            ['key' => 'event_venue', 'value' => null, 'type' => 'string', 'group' => 'event', 'label' => 'Lieu', 'is_public' => true],
            ['key' => 'event_city', 'value' => 'Douala', 'type' => 'string', 'group' => 'event', 'label' => 'Ville', 'is_public' => true],

            // --- Contact ---
            ['key' => 'contact_phone', 'value' => null, 'type' => 'string', 'group' => 'contact', 'label' => 'Telephone', 'is_public' => true],
            ['key' => 'contact_whatsapp', 'value' => null, 'type' => 'string', 'group' => 'contact', 'label' => 'WhatsApp', 'is_public' => true],
            ['key' => 'contact_email', 'value' => null, 'type' => 'string', 'group' => 'contact', 'label' => 'Email', 'is_public' => true],

            /*
             * --- Interrupteurs du jour J ---
             * Permettent d'ouvrir ou de fermer chaque parcours sans
             * redeployer. Lus par Category::isRegistrationOpen(),
             * isVotingOpen() et TicketType::isOnSale().
             */
            ['key' => 'registration_enabled', 'value' => '1', 'type' => 'boolean', 'group' => 'switches', 'label' => 'Inscriptions ouvertes', 'is_public' => true],
            ['key' => 'voting_enabled', 'value' => '1', 'type' => 'boolean', 'group' => 'switches', 'label' => 'Votes ouverts', 'is_public' => true],
            ['key' => 'ticketing_enabled', 'value' => '1', 'type' => 'boolean', 'group' => 'switches', 'label' => 'Billetterie ouverte', 'is_public' => true],

            /*
             * --- Affichage des resultats ---
             * L'organisation peut masquer les scores pendant la competition
             * pour ne pas influencer les votes, sans fermer le site.
             */
            ['key' => 'results_public', 'value' => '1', 'type' => 'boolean', 'group' => 'results', 'label' => 'Resultats accessibles', 'is_public' => true],
            ['key' => 'show_vote_counts', 'value' => '1', 'type' => 'boolean', 'group' => 'results', 'label' => 'Afficher le nombre de voix', 'is_public' => true],

            /*
             * --- Circuit de validation ---
             * A false, un dossier paye passe en « a valider » et attend un
             * controle humain avant d'etre publie.
             */
            ['key' => 'auto_approve_candidates', 'value' => '0', 'type' => 'boolean', 'group' => 'workflow', 'label' => 'Publier les candidats sans validation', 'is_public' => false],
        ];
    }
}
