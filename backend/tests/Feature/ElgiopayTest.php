<?php

namespace Tests\Feature;

use App\Enums\PaymentMethod;
use App\Enums\TransactionStatus;
use App\Enums\VoteStatus;
use App\Models\PaymentWebhook;
use App\Models\Transaction;
use App\Models\Vote;
use App\Services\Payments\Drivers\ElgiopayGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Integration Elgiopay.
 *
 * Les tests portent sur ce qui coute de l'argent en cas de regression :
 * l'authenticite des notifications, et la correspondance entre les etats de
 * la passerelle et les notres. Aucun appel reseau n'est effectue.
 */
class ElgiopayTest extends TestCase
{
    use RefreshDatabase, TestSupport;

    private const SECRET = 'whsec_test_0123456789abcdef';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'payments.driver' => 'elgiopay',
            'payments.drivers.elgiopay.base_url' => 'https://sandbox-api.elgiopay.com',
            'payments.drivers.elgiopay.secret_key' => 'sk_test_exemple',
            'payments.drivers.elgiopay.public_key' => 'pk_test_exemple',
            // Fixe explicitement : sans cela, la suite suivrait le reglage du
            // poste et changerait de resultat d'une machine a l'autre.
            'payments.drivers.elgiopay.auth_key' => 'secrete',
            'payments.drivers.elgiopay.webhook_secret' => self::SECRET,
        ]);
    }

    /** Collecte acceptee : la transaction reste en attente du payeur. */
    private function collecteAcceptee(string $identifiant = 'TXN_ABC123'): void
    {
        Http::fake([
            '*/api/v1/payments' => Http::response([
                'success' => true,
                'transaction_id' => $identifiant,
                'status' => 'pending',
                'payment_url' => null,
                'message' => 'Payment initiated successfully',
            ], 201),
        ]);
    }

    /** Lance un achat de votes et renvoie la transaction creee. */
    private function acheterDesVotes(int $quantite = 10, string $telephone = '677000000'): Transaction
    {
        $category = $this->makeCategory();
        $candidate = $this->makeCandidate($category);

        $this->postJson("/api/v1/candidates/{$candidate->slug}/votes", [
            'quantity' => $quantite,
            'voter_phone' => $telephone,
        ])->assertCreated();

        return Transaction::firstOrFail();
    }

    private function notifier(
        array $donnees,
        string $evenement = 'payment.completed',
        string $identifiant = 'evt_1',
        ?int $horodatage = null,
        ?string $signature = null,
    ) {
        $corps = json_encode([
            'id' => $identifiant,
            'event' => $evenement,
            'created' => $horodatage ?? time(),
            'data' => $donnees,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $t = $horodatage ?? time();
        $v1 = $signature ?? hash_hmac('sha256', "{$t}.{$corps}", self::SECRET);

        return $this->call(
            'POST',
            '/api/v1/webhooks/payments/elgiopay',
            [], [], [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_ELGIOPAY_SIGNATURE' => "t={$t},v1={$v1}",
                'HTTP_X_ELGIOPAY_EVENT' => $evenement,
                'HTTP_X_ELGIOPAY_EVENT_ID' => $identifiant,
            ],
            $corps,
        );
    }

    private function paiementReussi(string $identifiant = 'TXN_ABC123'): array
    {
        return [
            'transaction_id' => $identifiant,
            'type' => 'CHARGE',
            'status' => 'completed',
            'amount' => ['total' => 1000, 'currency' => 'XAF', 'fees' => 30, 'net_amount' => 970],
            'payment' => ['method' => 'mtn_mobile_money'],
            'customer' => ['phone' => '+237677000000'],
            'metadata' => [],
        ];
    }

    // --- Lancement de la collecte -----------------------------------------

    public function test_la_collecte_part_avec_l_operateur_deduit_du_numero(): void
    {
        $this->collecteAcceptee();
        $transaction = $this->acheterDesVotes();

        Http::assertSent(function ($requete) use ($transaction) {
            $corps = $requete->data();

            return str_ends_with($requete->url(), '/api/v1/payments')
                && $requete->hasHeader('Authorization', 'Bearer sk_test_exemple')
                && $corps['amount'] === $transaction->amount
                && $corps['currency'] === 'XAF'
                // 677 est un prefixe MTN.
                && $corps['payment_method'] === 'mtn_mobile_money'
                && $corps['customer_phone'] === '237677000000'
                // Notre reference voyage aussi dans metadata, pour pouvoir
                // retrouver la transaction sans l'identifiant Elgiopay.
                && $corps['metadata']['reference'] === $transaction->reference;
        });

        $this->assertSame(TransactionStatus::Processing, $transaction->status);
        $this->assertSame('TXN_ABC123', $transaction->provider_reference);
        $this->assertSame(0, Vote::firstOrFail()->candidate->votes_count);
    }

    /**
     * Leur bac a sable refuse la cle secrete en 401 et accepte la publique.
     * Ce reglage est donc ce qui decide, aujourd'hui, qu'un paiement aboutit
     * ou non : il merite d'etre tenu par un test et pas seulement par un
     * commentaire.
     */
    public function test_la_cle_publique_authentifie_quand_la_configuration_le_demande(): void
    {
        config([
            'payments.drivers.elgiopay.public_key' => 'pk_test_exemple',
            'payments.drivers.elgiopay.auth_key' => 'publique',
        ]);

        $this->collecteAcceptee();
        $this->acheterDesVotes();

        Http::assertSent(
            fn ($requete) => $requete->hasHeader('Authorization', 'Bearer pk_test_exemple'),
        );
    }

    /** Par defaut, c'est la cle secrete qui part : le reglage reste explicite. */
    public function test_la_cle_secrete_authentifie_par_defaut(): void
    {
        $this->collecteAcceptee();
        $this->acheterDesVotes();

        Http::assertSent(
            fn ($requete) => $requete->hasHeader('Authorization', 'Bearer sk_test_exemple'),
        );
    }

    /**
     * Orange represente la moitie des payeurs. Les deux reseaux ne portent pas
     * le meme nom chez Elgiopay, et une collecte adressee au mauvais reseau
     * echoue chez l'operateur, bien apres notre reponse au candidat.
     */
    public function test_un_numero_orange_part_sur_le_reseau_orange(): void
    {
        $this->collecteAcceptee();
        $this->acheterDesVotes(telephone: '699000000');

        Http::assertSent(function ($requete) {
            $corps = $requete->data();

            return str_ends_with($requete->url(), '/api/v1/payments')
                // 699 est un prefixe Orange.
                && $corps['payment_method'] === 'orange_money'
                && $corps['customer_phone'] === '237699000000';
        });
    }

    /**
     * Le chemin de retour compte autant que l'aller : c'est l'operateur
     * enregistre sur la transaction qui alimente la reconciliation et les
     * recettes par reseau.
     */
    public function test_une_notification_orange_enregistre_le_bon_operateur(): void
    {
        $this->collecteAcceptee();
        $transaction = $this->acheterDesVotes(10, '699000000');

        $this->notifier([
            ...$this->paiementReussi(),
            'payment' => ['method' => 'orange_money'],
            'customer' => ['phone' => '+237699000000'],
        ])->assertOk();

        $fraiche = $transaction->fresh();

        $this->assertSame(TransactionStatus::Succeeded, $fraiche->status);
        $this->assertSame(PaymentMethod::OrangeMoney, $fraiche->payment_method);
    }

    public function test_un_refus_de_la_passerelle_fait_echouer_le_paiement(): void
    {
        Http::fake([
            '*/api/v1/payments' => Http::response([
                'error' => 'Validation failed',
                'message' => 'The given data was invalid',
                'errors' => ['amount' => ['The amount field is required.']],
            ], 422),
        ]);

        $this->acheterDesVotes();

        $this->assertSame(TransactionStatus::Failed, Transaction::firstOrFail()->status);
        $this->assertSame(VoteStatus::Failed, Vote::firstOrFail()->status);
    }

    // --- Notifications -----------------------------------------------------

    public function test_une_notification_signee_credite_les_voix(): void
    {
        $this->collecteAcceptee();
        $transaction = $this->acheterDesVotes(10);

        $this->notifier($this->paiementReussi())->assertOk();

        $this->assertSame(TransactionStatus::Succeeded, $transaction->fresh()->status);
        $this->assertSame(VoteStatus::Confirmed, Vote::firstOrFail()->status);
        $this->assertSame(10, Vote::firstOrFail()->candidate->votes_count);
    }

    public function test_une_signature_invalide_est_refusee(): void
    {
        $this->collecteAcceptee();
        $transaction = $this->acheterDesVotes();

        // Repond 200 pour ne pas declencher de rejeu, mais ne traite rien.
        $this->notifier($this->paiementReussi(), signature: str_repeat('0', 64))
            ->assertOk();

        $this->assertSame(TransactionStatus::Processing, $transaction->fresh()->status);
        $this->assertSame(0, Vote::firstOrFail()->candidate->votes_count);

        $trace = PaymentWebhook::firstOrFail();
        $this->assertFalse($trace->signature_valid);
        $this->assertNull($trace->processed_at);
    }

    public function test_une_notification_rejouee_hors_fenetre_est_refusee(): void
    {
        $this->collecteAcceptee();
        $transaction = $this->acheterDesVotes();

        // Notification authentique capturee puis renvoyee une heure plus tard.
        $this->notifier($this->paiementReussi(), horodatage: time() - 3600)
            ->assertOk();

        $this->assertSame(TransactionStatus::Processing, $transaction->fresh()->status);
        $this->assertSame(0, Vote::firstOrFail()->candidate->votes_count);
        $this->assertFalse(PaymentWebhook::firstOrFail()->signature_valid);
    }

    public function test_le_rejeu_d_un_meme_evenement_ne_recompte_pas_les_voix(): void
    {
        $this->collecteAcceptee();
        $this->acheterDesVotes(25);

        // Elgiopay rejoue jusqu'a huit fois tant qu'il n'a pas de 2xx.
        foreach (range(1, 4) as $ignored) {
            $this->notifier($this->paiementReussi(), identifiant: 'evt_identique')
                ->assertOk();
        }

        $this->assertSame(25, Vote::firstOrFail()->candidate->votes_count);
        $this->assertDatabaseCount('payment_webhooks', 1);
    }

    public function test_un_echec_notifie_n_octroie_aucune_voix(): void
    {
        $this->collecteAcceptee();
        $transaction = $this->acheterDesVotes();

        $this->notifier(
            [...$this->paiementReussi(), 'status' => 'failed', 'error_code' => 9202],
            evenement: 'payment.failed',
        )->assertOk();

        $fraiche = $transaction->fresh();

        $this->assertSame(TransactionStatus::Failed, $fraiche->status);
        $this->assertSame(
            'Solde insuffisant sur le compte Mobile Money.',
            $fraiche->failure_reason,
        );
        $this->assertSame(0, Vote::firstOrFail()->candidate->votes_count);
    }

    public function test_un_evenement_hors_paiement_est_acquitte_sans_effet(): void
    {
        $this->collecteAcceptee();
        $transaction = $this->acheterDesVotes();

        // Elgiopay annonce aussi ses versements : rien a faire de notre cote.
        $this->notifier(
            ['payout_id' => 'POabc', 'status' => 'completed'],
            evenement: 'payout.completed',
        )->assertOk();

        $this->assertSame(TransactionStatus::Processing, $transaction->fresh()->status);
        $this->assertNotNull(PaymentWebhook::firstOrFail()->processed_at);
    }

    public function test_une_notification_pour_une_transaction_inconnue_est_tracee(): void
    {
        $this->notifier($this->paiementReussi('TXN_INCONNUE'))->assertOk();

        $trace = PaymentWebhook::firstOrFail();

        $this->assertTrue($trace->signature_valid);
        $this->assertNull($trace->processed_at);
        $this->assertSame('Transaction introuvable.', $trace->error);
    }

    // --- Tresorerie --------------------------------------------------------

    public function test_le_solde_du_compte_est_lisible(): void
    {
        Http::fake([
            '*/api/v1/balance*' => Http::response([
                'success' => true,
                'data' => [
                    'currency' => 'XAF',
                    'available_balance' => 124500,
                    'pending_balance' => 5000,
                    'total_balance' => 129500,
                ],
            ]),
        ]);

        $solde = (new ElgiopayGateway(
            config('payments.drivers.elgiopay')
        ))->balance('XAF');

        $this->assertSame(
            ['currency' => 'XAF', 'available' => 124500, 'pending' => 5000, 'total' => 129500],
            $solde,
        );
    }

    public function test_le_solde_est_lu_dans_la_forme_reellement_renvoyee(): void
    {
        /*
         * Leur documentation annonce un objet enveloppe dans `data`, avec
         * `pending_balance` et `total_balance` en nombres. L'API renvoie en
         * fait les champs au premier niveau, sous `reserved_balance` et
         * `balance`, et en chaines decimales. Constate le 7 octobre 2026.
         */
        Http::fake([
            '*/api/v1/balance*' => Http::response([
                'balance' => '78400.00',
                'currency' => 'XAF',
                'available_balance' => '78400.00',
                'reserved_balance' => '0.00',
            ]),
        ]);

        $solde = (new ElgiopayGateway(
            config('payments.drivers.elgiopay')
        ))->balance('XAF');

        // Le franc CFA n'a pas de sous-unite : les decimales sont ramenees.
        $this->assertSame(
            ['currency' => 'XAF', 'available' => 78400, 'pending' => 0, 'total' => 78400],
            $solde,
        );
    }

    public function test_une_cle_refusee_rend_le_solde_illisible(): void
    {
        // Le diagnostic s'appuie dessus pour distinguer une cle invalide d'un
        // paiement refuse, qui s'afficheraient autrement tous deux en echec.
        Http::fake([
            '*/api/v1/balance*' => Http::response([
                'error' => 'API key required',
            ], 401),
        ]);

        $this->assertNull(
            (new ElgiopayGateway(
                config('payments.drivers.elgiopay')
            ))->balance('XAF'),
        );
    }
}
