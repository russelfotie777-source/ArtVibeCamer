<?php

namespace Tests\Feature;

use App\Enums\RegistrationType;
use App\Models\Candidate;
use App\Models\CandidateMember;
use App\Models\Transaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Inscription en groupe : tarif different, membres declares, et categories
 * qui n'acceptent que l'individuel.
 */
class GroupRegistrationTest extends TestCase
{
    use RefreshDatabase, TestSupport;

    private function dossier(array $remplace = []): array
    {
        return [
            'first_name' => 'Arnaud',
            'last_name' => 'Nkolo',
            'phone' => '671234567',
            'accepts_terms' => true,
            ...$remplace,
        ];
    }

    public function test_une_inscription_individuelle_est_facturee_au_tarif_solo(): void
    {
        $category = $this->makeCategory();

        $this->postJson('/api/v1/registrations', $this->dossier([
            'category_id' => $category->id,
            'registration_type' => 'solo',
        ]))->assertCreated()->assertJsonPath('transaction.amount', 8000);

        $this->assertSame(RegistrationType::Solo, Candidate::firstOrFail()->registration_type);
    }

    public function test_une_inscription_en_groupe_est_facturee_au_tarif_groupe(): void
    {
        $category = $this->makeCategory();

        $this->postJson('/api/v1/registrations', $this->dossier([
            'category_id' => $category->id,
            'registration_type' => 'group',
            'group_name' => 'Les Enfants du Wouri',
            'members' => [
                ['full_name' => 'Arnaud Nkolo'],
                ['full_name' => 'Clarisse Mbarga'],
                ['full_name' => 'Serge Etoa'],
            ],
        ]))->assertCreated()->assertJsonPath('transaction.amount', 10000);

        $candidate = Candidate::firstOrFail();

        $this->assertTrue($candidate->isGroup());
        $this->assertSame('Les Enfants du Wouri', $candidate->group_name);
        // Le nom public d'un groupe est celui de la formation.
        $this->assertSame('Les Enfants du Wouri', $candidate->display_name);
        $this->assertSame(3, $candidate->members_count);
        $this->assertSame(3, CandidateMember::count());
        $this->assertSame(
            ['Arnaud Nkolo', 'Clarisse Mbarga', 'Serge Etoa'],
            $candidate->members()->pluck('full_name')->all(),
        );
    }

    public function test_une_categorie_individuelle_refuse_les_groupes(): void
    {
        // Miss & Master : group_fee a null ferme la formule groupe.
        $category = $this->makeCategory([
            'name' => 'Miss & Master',
            'registration_fee' => 10000,
            'group_fee' => null,
        ]);

        $this->postJson('/api/v1/registrations', $this->dossier([
            'category_id' => $category->id,
            'registration_type' => 'group',
            'group_name' => 'Duo',
            'members' => [
                ['full_name' => 'Une personne'],
                ['full_name' => 'Une autre'],
            ],
        ]))->assertStatus(422);

        $this->assertDatabaseCount('candidates', 0);
    }

    public function test_une_categorie_individuelle_facture_son_propre_tarif(): void
    {
        $category = $this->makeCategory([
            'name' => 'Miss & Master',
            'registration_fee' => 10000,
            'group_fee' => null,
        ]);

        $this->postJson('/api/v1/registrations', $this->dossier([
            'category_id' => $category->id,
            'registration_type' => 'solo',
        ]))->assertCreated()->assertJsonPath('transaction.amount', 10000);
    }

    public function test_un_groupe_de_moins_de_deux_membres_est_refuse(): void
    {
        $category = $this->makeCategory();

        $this->postJson('/api/v1/registrations', $this->dossier([
            'category_id' => $category->id,
            'registration_type' => 'group',
            'group_name' => 'Solo deguise',
            'members' => [['full_name' => 'Arnaud Nkolo']],
        ]))->assertStatus(422);

        $this->assertDatabaseCount('candidates', 0);
    }

    public function test_le_plafond_de_membres_de_la_categorie_est_applique(): void
    {
        $category = $this->makeCategory(['max_group_members' => 4]);

        $membres = array_map(
            fn (int $i) => ['full_name' => "Membre {$i}"],
            range(1, 6),
        );

        $this->postJson('/api/v1/registrations', $this->dossier([
            'category_id' => $category->id,
            'registration_type' => 'group',
            'group_name' => 'Trop nombreux',
            'members' => $membres,
        ]))->assertStatus(422);

        $this->assertDatabaseCount('candidates', 0);
        // Rien ne doit subsister d'une inscription refusee.
        $this->assertDatabaseCount('candidate_members', 0);
    }

    public function test_l_email_est_facultatif(): void
    {
        $category = $this->makeCategory();

        $this->postJson('/api/v1/registrations', $this->dossier([
            'category_id' => $category->id,
            'registration_type' => 'solo',
        ]))->assertCreated();

        $this->assertNull(Candidate::firstOrFail()->email);
    }

    public function test_deux_inscriptions_sans_email_sont_possibles(): void
    {
        $category = $this->makeCategory();

        foreach (['671111111', '671111112'] as $numero) {
            $this->postJson('/api/v1/registrations', $this->dossier([
                'category_id' => $category->id,
                'registration_type' => 'solo',
                'phone' => $numero,
            ]))->assertCreated();
        }

        // L'unicite ne porte que sur les adresses reellement fournies.
        $this->assertDatabaseCount('candidates', 2);
    }

    public function test_la_relance_reprend_le_tarif_de_la_formule(): void
    {
        $category = $this->makeCategory();

        $echec = $this->postJson('/api/v1/registrations', $this->dossier([
            'category_id' => $category->id,
            'registration_type' => 'group',
            'group_name' => 'Les Enfants du Wouri',
            'phone' => '671234560', // la simulation refuse les numeros en 0
            'members' => [
                ['full_name' => 'Arnaud Nkolo'],
                ['full_name' => 'Clarisse Mbarga'],
            ],
        ]))->assertCreated();

        $this->postJson("/api/v1/registrations/{$echec->json('transaction.reference')}/retry", [
            'payer_phone' => '671234567',
        ])->assertCreated();

        // Tarif groupe, et non celui du solo.
        $this->assertSame(10000, Transaction::latest('id')->first()->amount);
        $this->assertNotNull(Candidate::firstOrFail()->candidate_number);
    }
}
