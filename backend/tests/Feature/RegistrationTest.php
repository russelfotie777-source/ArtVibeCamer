<?php

namespace Tests\Feature;

use App\Enums\CandidateStatus;
use App\Enums\TransactionStatus;
use App\Models\Candidate;
use App\Models\Category;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase, TestSupport;

    public function test_une_inscription_payee_recoit_un_numero_de_candidat(): void
    {
        $category = $this->makeCategory();

        $response = $this->postJson('/api/v1/registrations', [
            'category_id' => $category->id,
            'first_name' => 'Arnaud',
            'last_name' => 'Nkolo',
            'stage_name' => 'Arno Vibe',
            'email' => 'arnaud.nkolo@example.cm',
            'phone' => '671234567',
            'accepts_terms' => true,
        ]);

        $response->assertCreated();

        $candidate = Candidate::firstOrFail();

        // Le numero n'est attribue que par le fulfilment du paiement.
        $this->assertSame('AVC-MUS-001', $candidate->candidate_number);
        $this->assertSame(CandidateStatus::PendingReview, $candidate->status);
        $this->assertSame(TransactionStatus::Succeeded, $candidate->registrationTransaction->status);
        $this->assertSame(15000, $candidate->registrationTransaction->amount);

        // Le compteur de la categorie suit.
        $this->assertSame(1, $category->fresh()->candidates_count);
    }

    public function test_un_paiement_refuse_ne_donne_aucun_numero(): void
    {
        $category = $this->makeCategory();

        // La passerelle de simulation refuse les numeros finissant par 0.
        $this->postJson('/api/v1/registrations', [
            'category_id' => $category->id,
            'first_name' => 'Paul',
            'last_name' => 'Essomba',
            'email' => 'paul@example.cm',
            'phone' => '671234560',
            'accepts_terms' => true,
        ])->assertCreated();

        $candidate = Candidate::firstOrFail();

        $this->assertNull($candidate->candidate_number);
        $this->assertSame(CandidateStatus::AwaitingPayment, $candidate->status);
        $this->assertSame(0, $category->fresh()->candidates_count);
    }

    public function test_les_numeros_sont_sequentiels_par_categorie(): void
    {
        $musique = $this->makeCategory(['name' => 'Musique']);
        $humour = $this->makeCategory(['name' => 'Humour', 'registration_fee' => 10000]);

        foreach ([
            [$musique, 'a@example.cm', '671111111'],
            [$musique, 'b@example.cm', '671111112'],
            [$humour, 'c@example.cm', '671111113'],
        ] as [$category, $email, $phone]) {
            $this->postJson('/api/v1/registrations', [
                'category_id' => $category->id,
                'first_name' => 'Candidat',
                'last_name' => 'Test',
                'email' => $email,
                'phone' => $phone,
                'accepts_terms' => true,
            ])->assertCreated();
        }

        $this->assertSame(
            ['AVC-MUS-001', 'AVC-MUS-002', 'AVC-HUM-001'],
            Candidate::orderBy('id')->pluck('candidate_number')->all(),
        );
    }

    public function test_un_email_deja_inscrit_est_refuse(): void
    {
        $category = $this->makeCategory();
        $this->makeCandidate($category, ['email' => 'deja@example.cm', 'phone' => '237670000001']);

        $this->postJson('/api/v1/registrations', [
            'category_id' => $category->id,
            'first_name' => 'Autre',
            'last_name' => 'Personne',
            'email' => 'deja@example.cm',
            'phone' => '671234567',
            'accepts_terms' => true,
        ])->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_un_numero_non_camerounais_est_refuse(): void
    {
        $category = $this->makeCategory();

        $this->postJson('/api/v1/registrations', [
            'category_id' => $category->id,
            'first_name' => 'Jean',
            'last_name' => 'Test',
            'email' => 'jean@example.cm',
            'phone' => '612345678',
            'accepts_terms' => true,
        ])->assertStatus(422)->assertJsonValidationErrors('phone');
    }

    public function test_une_categorie_pleine_refuse_les_inscriptions(): void
    {
        $category = $this->makeCategory(['max_candidates' => 1]);
        Category::whereKey($category->id)->update(['candidates_count' => 1]);

        $this->postJson('/api/v1/registrations', [
            'category_id' => $category->id,
            'first_name' => 'Trop',
            'last_name' => 'Tard',
            'email' => 'troptard@example.cm',
            'phone' => '671234567',
            'accepts_terms' => true,
        ])->assertStatus(422);
    }

    public function test_un_paiement_echoue_peut_etre_relance_sans_ressaisie(): void
    {
        $category = $this->makeCategory();

        // Numero finissant par 0 : la simulation refuse le paiement.
        $echec = $this->postJson('/api/v1/registrations', [
            'category_id' => $category->id,
            'first_name' => 'Paul',
            'last_name' => 'Essomba',
            'email' => 'paul@example.cm',
            'phone' => '671234560',
            'accepts_terms' => true,
        ])->assertCreated();

        $reference = $echec->json('transaction.reference');
        $this->assertNull(Candidate::firstOrFail()->candidate_number);

        // Relance avec un numero qui aboutit, sans renvoyer le formulaire.
        $this->postJson("/api/v1/registrations/{$reference}/retry", [
            'payer_phone' => '671234567',
        ])->assertCreated();

        $candidate = Candidate::firstOrFail();

        $this->assertSame('AVC-MUS-001', $candidate->candidate_number);
        $this->assertSame(CandidateStatus::PendingReview, $candidate->status);

        // Le dossier n'a pas ete duplique.
        $this->assertDatabaseCount('candidates', 1);
    }

    public function test_une_inscription_deja_payee_ne_peut_pas_etre_relancee(): void
    {
        $category = $this->makeCategory();

        $ok = $this->postJson('/api/v1/registrations', [
            'category_id' => $category->id,
            'first_name' => 'Arnaud',
            'last_name' => 'Nkolo',
            'email' => 'arnaud@example.cm',
            'phone' => '671234567',
            'accepts_terms' => true,
        ])->assertCreated();

        $this->postJson("/api/v1/registrations/{$ok->json('transaction.reference')}/retry")
            ->assertStatus(422);
    }
}
