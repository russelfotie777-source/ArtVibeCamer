<?php

namespace Tests\Feature;

use App\Enums\CandidateStatus;
use App\Enums\VoteStatus;
use App\Models\Transaction;
use App\Models\Vote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VotingTest extends TestCase
{
    use RefreshDatabase, TestSupport;

    public function test_les_voix_sont_creditees_apres_paiement(): void
    {
        $category = $this->makeCategory();
        $candidate = $this->makeCandidate($category);

        $this->postJson("/api/v1/candidates/{$candidate->slug}/votes", [
            'quantity' => 25,
            'voter_phone' => '699887766',
        ])->assertCreated();

        $this->assertSame(25, $candidate->fresh()->votes_count);
        $this->assertSame(25, $category->fresh()->votes_count);
        $this->assertSame(VoteStatus::Confirmed, Vote::firstOrFail()->status);
    }

    public function test_le_montant_est_calcule_par_le_serveur(): void
    {
        $category = $this->makeCategory(['vote_price' => 100]);
        $candidate = $this->makeCandidate($category);

        // Le client tente d'imposer son propre prix.
        $this->postJson("/api/v1/candidates/{$candidate->slug}/votes", [
            'quantity' => 3,
            'voter_phone' => '699887766',
            'unit_price' => 1,
            'total_amount' => 3,
            'amount' => 3,
        ])->assertCreated();

        $vote = Vote::firstOrFail();

        $this->assertSame(100, $vote->unit_price);
        $this->assertSame(300, $vote->total_amount);
        $this->assertSame(300, $vote->transaction->amount);
    }

    public function test_un_paiement_refuse_ne_credite_aucune_voix(): void
    {
        $category = $this->makeCategory();
        $candidate = $this->makeCandidate($category);

        // Numero finissant par 0 : la simulation refuse le paiement.
        $this->postJson("/api/v1/candidates/{$candidate->slug}/votes", [
            'quantity' => 50,
            'voter_phone' => '699887760',
        ])->assertCreated();

        $this->assertSame(0, $candidate->fresh()->votes_count);
        $this->assertSame(VoteStatus::Failed, Vote::firstOrFail()->status);
    }

    public function test_le_rejeu_d_une_notification_ne_recompte_pas_les_voix(): void
    {
        $category = $this->makeCategory();
        $candidate = $this->makeCandidate($category);

        $this->postJson("/api/v1/candidates/{$candidate->slug}/votes", [
            'quantity' => 10,
            'voter_phone' => '699887766',
        ])->assertCreated();

        $this->assertSame(10, $candidate->fresh()->votes_count);

        $reference = Transaction::firstOrFail()->reference;

        // Les passerelles Mobile Money rejouent leurs notifications.
        foreach (range(1, 4) as $i) {
            $this->postJson('/api/v1/webhooks/payments/fake', [
                'reference' => $reference,
                'status' => 'succeeded',
                'event_id' => "EVT-{$i}",
            ])->assertOk();
        }

        $this->assertSame(10, $candidate->fresh()->votes_count);
    }

    public function test_un_meme_event_id_n_est_enregistre_qu_une_fois(): void
    {
        $category = $this->makeCategory();
        $candidate = $this->makeCandidate($category);

        $this->postJson("/api/v1/candidates/{$candidate->slug}/votes", [
            'quantity' => 5,
            'voter_phone' => '699887766',
        ])->assertCreated();

        foreach (range(1, 3) as $ignored) {
            $this->postJson('/api/v1/webhooks/payments/fake', [
                'reference' => Transaction::firstOrFail()->reference,
                'status' => 'succeeded',
                'event_id' => 'EVT-IDENTIQUE',
            ])->assertOk();
        }

        $this->assertDatabaseCount('payment_webhooks', 1);
    }

    public function test_un_candidat_non_valide_ne_peut_pas_recevoir_de_votes(): void
    {
        $category = $this->makeCategory();
        $candidate = $this->makeCandidate($category, ['status' => CandidateStatus::PendingReview]);

        $this->postJson("/api/v1/candidates/{$candidate->slug}/votes", [
            'quantity' => 5,
            'voter_phone' => '699887766',
        ])->assertStatus(422);

        $this->assertSame(0, $candidate->fresh()->votes_count);
    }

    public function test_l_annulation_d_un_lot_retire_les_voix(): void
    {
        $category = $this->makeCategory();
        $candidate = $this->makeCandidate($category);
        $admin = $this->makeUser();

        $this->postJson("/api/v1/candidates/{$candidate->slug}/votes", [
            'quantity' => 40,
            'voter_phone' => '699887766',
        ])->assertCreated();

        $this->assertSame(40, $candidate->fresh()->votes_count);

        $vote = Vote::firstOrFail();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/votes/{$vote->id}/cancel", [
                'reason' => 'Lot identifie comme frauduleux lors du depouillement.',
            ])->assertOk();

        $this->assertSame(0, $candidate->fresh()->votes_count);
        $this->assertSame(0, $category->fresh()->votes_count);
        $this->assertSame(VoteStatus::Cancelled, $vote->fresh()->status);
    }
}
