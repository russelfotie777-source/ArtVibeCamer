<?php

namespace Tests\Feature;

use App\Models\Transaction;
use App\Services\Reporting\StatsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Commission de la passerelle.
 *
 * Le tableau de bord doit distinguer ce que les payeurs ont verse de ce que
 * l'organisation touche. Confondre les deux fausse les comptes rendus a
 * l'organisateur et aux sponsors.
 */
class CommissionTest extends TestCase
{
    use RefreshDatabase, TestSupport;

    public function test_la_commission_est_conservee_a_l_encaissement(): void
    {
        config([
            'payments.driver' => 'elgiopay',
            'payments.drivers.elgiopay.api_key' => 'pk_test_exemple',
        ]);

        Http::fake([
            '*/api/v1/payments' => Http::response([
                'success' => true,
                'transaction_id' => 'TXN_1',
                'status' => 'completed',
                'amount' => ['total' => 8000, 'currency' => 'XAF', 'fees' => 160, 'net_amount' => 7840],
                'payment' => ['method' => 'mtn_mobile_money'],
            ], 201),
        ]);

        $category = $this->makeCategory();

        $this->postJson('/api/v1/registrations', [
            'category_id' => $category->id,
            'registration_type' => 'solo',
            'first_name' => 'Arnaud',
            'last_name' => 'Nkolo',
            'phone' => '671234567',
            'accepts_terms' => true,
        ])->assertCreated();

        $transaction = Transaction::firstOrFail();

        $this->assertSame(8000, $transaction->amount);
        $this->assertSame(160, $transaction->fees);
        $this->assertSame(7840, $transaction->net_amount);
        $this->assertSame(7840, $transaction->creditedAmount());
    }

    public function test_le_tableau_de_bord_distingue_le_brut_du_net(): void
    {
        config([
            'payments.driver' => 'elgiopay',
            'payments.drivers.elgiopay.api_key' => 'pk_test_exemple',
        ]);

        Http::fake([
            '*/api/v1/payments' => Http::response([
                'success' => true,
                'transaction_id' => 'TXN_1',
                'status' => 'completed',
                'amount' => ['total' => 8000, 'currency' => 'XAF', 'fees' => 160, 'net_amount' => 7840],
            ], 201),
        ]);

        $category = $this->makeCategory();

        $this->postJson('/api/v1/registrations', [
            'category_id' => $category->id,
            'registration_type' => 'solo',
            'first_name' => 'Arnaud',
            'last_name' => 'Nkolo',
            'phone' => '671234567',
            'accepts_terms' => true,
        ])->assertCreated();

        $recettes = app(StatsService::class)->overview()['revenue'];

        $this->assertSame(8000, $recettes['total'], 'le brut reste ce que le candidat a paye');
        $this->assertSame(160, $recettes['fees']);
        $this->assertSame(7840, $recettes['net'], 'le net est ce que l\'organisation touche');
    }

    public function test_sans_frais_communiques_le_net_retombe_sur_le_brut(): void
    {
        // La simulation et les encaissements hors ligne ne produisent pas de
        // frais : compter zero sous-estimerait la recette.
        $category = $this->makeCategory();

        $this->postJson('/api/v1/registrations', [
            'category_id' => $category->id,
            'registration_type' => 'solo',
            'first_name' => 'Arnaud',
            'last_name' => 'Nkolo',
            'phone' => '671234567',
            'accepts_terms' => true,
        ])->assertCreated();

        $recettes = app(StatsService::class)->overview()['revenue'];

        $this->assertSame(8000, $recettes['total']);
        $this->assertSame(0, $recettes['fees']);
        $this->assertSame(8000, $recettes['net']);
    }

    public function test_la_commission_arrive_par_la_notification(): void
    {
        /*
         * Parcours reel : POST /payments repond « pending » sans detail de
         * montant, et la commission n'arrive qu'avec la confirmation.
         */
        config([
            'payments.driver' => 'elgiopay',
            'payments.drivers.elgiopay.api_key' => 'pk_test_exemple',
            'payments.drivers.elgiopay.webhook_secret' => 'whsec_exemple',
        ]);

        Http::fake([
            '*/api/v1/payments' => Http::response([
                'success' => true,
                'transaction_id' => 'TXN_2',
                'status' => 'pending',
                'payment_url' => null,
            ], 201),
        ]);

        $category = $this->makeCategory();

        $this->postJson('/api/v1/registrations', [
            'category_id' => $category->id,
            'registration_type' => 'solo',
            'first_name' => 'Arnaud',
            'last_name' => 'Nkolo',
            'phone' => '671234567',
            'accepts_terms' => true,
        ])->assertCreated();

        $this->assertNull(Transaction::firstOrFail()->fees);

        $corps = json_encode([
            'id' => 'evt_commission',
            'event' => 'payment.completed',
            'created' => time(),
            'data' => [
                'transaction_id' => 'TXN_2',
                'status' => 'completed',
                'amount' => ['total' => 8000, 'currency' => 'XAF', 'fees' => 160, 'net_amount' => 7840],
                'payment' => ['method' => 'mtn_mobile_money'],
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $t = time();

        $this->call('POST', '/api/v1/webhooks/payments/elgiopay', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_ELGIOPAY_SIGNATURE' => "t={$t},v1=".hash_hmac('sha256', "{$t}.{$corps}", 'whsec_exemple'),
            'HTTP_X_ELGIOPAY_EVENT' => 'payment.completed',
            'HTTP_X_ELGIOPAY_EVENT_ID' => 'evt_commission',
        ], $corps)->assertOk();

        $transaction = Transaction::firstOrFail();

        $this->assertSame(160, $transaction->fees);
        $this->assertSame(7840, $transaction->net_amount);
    }
}
