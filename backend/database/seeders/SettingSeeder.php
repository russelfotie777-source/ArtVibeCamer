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
            ['key' => 'event_name', 'value' => 'ArtVibeCamer', 'type' => 'string', 'group' => 'event', 'label' => 'Nom de l\'événement', 'is_public' => true],
            ['key' => 'event_tagline', 'value' => 'La culture, les talents et l\'art camerounais sur une seule scène.', 'type' => 'string', 'group' => 'event', 'label' => 'Accroche', 'is_public' => true],
            ['key' => 'event_date', 'value' => null, 'type' => 'datetime', 'group' => 'event', 'label' => 'Date de l\'événement', 'is_public' => true],
            ['key' => 'event_venue', 'value' => 'Salle des fêtes d\'Akwa', 'type' => 'string', 'group' => 'event', 'label' => 'Lieu', 'is_public' => true],
            ['key' => 'event_city', 'value' => 'Douala', 'type' => 'string', 'group' => 'event', 'label' => 'Ville', 'is_public' => true],

            // --- Castings, tels qu'annonces sur les affiches ---
            ['key' => 'registration_window', 'value' => 'Du 10 au 30 octobre 2026', 'type' => 'string', 'group' => 'event', 'label' => 'Période d\'inscription', 'is_public' => true],
            ['key' => 'casting_douala', 'value' => 'Salle des fêtes d\'Akwa, Douala — à partir du 8 novembre 2026', 'type' => 'string', 'group' => 'event', 'label' => 'Casting Douala', 'is_public' => true],
            ['key' => 'casting_yaounde', 'value' => 'Yaoundé — à partir du 16 novembre 2026', 'type' => 'string', 'group' => 'event', 'label' => 'Casting Yaoundé', 'is_public' => true],

            // --- Contact ---
            ['key' => 'contact_phone', 'value' => '+237 696 43 47 86', 'type' => 'string', 'group' => 'contact', 'label' => 'Téléphone', 'is_public' => true],
            ['key' => 'contact_phone_2', 'value' => '+237 686 77 26 60', 'type' => 'string', 'group' => 'contact', 'label' => 'Téléphone (2)', 'is_public' => true],
            ['key' => 'contact_whatsapp', 'value' => null, 'type' => 'string', 'group' => 'contact', 'label' => 'WhatsApp', 'is_public' => true],
            ['key' => 'contact_email', 'value' => null, 'type' => 'string', 'group' => 'contact', 'label' => 'Email', 'is_public' => true],

            /*
             * --- Interrupteurs du jour J ---
             * Permettent d'ouvrir ou de fermer chaque parcours sans
             * redeployer. Lus par Category::isRegistrationOpen(),
             * isVotingOpen() et TicketType::isOnSale().
             */
            ['key' => 'registration_enabled', 'value' => '1', 'type' => 'boolean', 'group' => 'switches', 'label' => 'Inscriptions ouvertes', 'is_public' => true],
            // Ferme au demarrage : les votes n'ouvrent qu'apres les castings.
            ['key' => 'voting_enabled', 'value' => '0', 'type' => 'boolean', 'group' => 'switches', 'label' => 'Votes ouverts', 'is_public' => true],
            ['key' => 'ticketing_enabled', 'value' => '0', 'type' => 'boolean', 'group' => 'switches', 'label' => 'Billetterie ouverte', 'is_public' => true],

            /*
             * --- Affichage des resultats ---
             * L'organisation peut masquer les scores pendant la competition
             * pour ne pas influencer les votes, sans fermer le site.
             */
            ['key' => 'results_public', 'value' => '1', 'type' => 'boolean', 'group' => 'results', 'label' => 'Résultats accessibles', 'is_public' => true],
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
