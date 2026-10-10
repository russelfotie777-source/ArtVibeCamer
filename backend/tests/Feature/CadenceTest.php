<?php

namespace Tests\Feature;

use App\Models\Transaction;
use App\Services\Payments\CadenceSortante;
use App\Services\Payments\Drivers\ElgiopayGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Charge imposee a la passerelle.
 *
 * Une passerelle de paiement est un service partage. La saturer degrade le
 * service de tous ses clients et finit par nous faire bloquer — ce qui, un
 * jour d'ouverture des inscriptions, revient a fermer la billetterie.
 */
class CadenceTest extends TestCase
{
    use RefreshDatabase, TestSupport;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'payments.driver' => 'elgiopay',
            'payments.drivers.elgiopay.secret_key' => 'sk_test_exemple',
            'payments.drivers.elgiopay.auth_key' => 'secrete',
            'payments.drivers.elgiopay.webhook_secret' => 'whsec_exemple',
        ]);
    }

    private function paiementEnAttente(): Transaction
    {
        Http::fake([
            '*/api/v1/payments' => Http::response([
                'success' => true,
                'transaction_id' => 'TXN_1',
                'status' => 'pending',
            ], 201),
            '*/api/v1/payments/*' => Http::response([
                'transaction_id' => 'TXN_1',
                'status' => 'pending',
            ]),
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

        // Le suivi n'interroge la passerelle qu'une fois passe le temps de
        // saisie du code.
        $transaction->forceFill(['processing_at' => now()->subMinute()])->save();

        return $transaction;
    }

    public function test_l_ecran_d_attente_n_interroge_la_passerelle_qu_une_fois_par_intervalle(): void
    {
        $transaction = $this->paiementEnAttente();

        Http::fake([
            '*/api/v1/payments/*' => Http::response([
                'transaction_id' => 'TXN_1',
                'status' => 'pending',
            ]),
        ]);

        // Le candidat, ou plusieurs onglets ouverts, rafraichissent dix fois.
        foreach (range(1, 10) as $ignored) {
            $this->getJson("/api/v1/payments/{$transaction->reference}")->assertOk();
        }

        // Une seule a atteint la passerelle. Sans ce garde-fou, cent candidats
        // devant leur telephone produisaient des dizaines d'appels par seconde.
        Http::assertSentCount(1);
    }

    public function test_une_transaction_tranchee_n_est_plus_interrogee(): void
    {
        $transaction = $this->paiementEnAttente();
        $transaction->forceFill(['status' => 'succeeded', 'paid_at' => now()])->save();

        Http::fake();

        foreach (range(1, 5) as $ignored) {
            $this->getJson("/api/v1/payments/{$transaction->reference}")->assertOk();
        }

        Http::assertNothingSent();
    }

    public function test_la_cadence_sortante_plafonne_les_appels_par_seconde(): void
    {
        $cadence = new CadenceSortante('essai', parSeconde: 3, attenteMax: 1);

        /*
         * Le compteur est indexe sur la seconde en cours. Demarrer en fin de
         * seconde reduirait l'attente observee a quelques centiemes et ferait
         * echouer la mesure sans qu'aucun plafond soit en cause : on se cale
         * donc sur un debut de seconde avant de chronometrer.
         */
        usleep((int) ((1 - (microtime(true) - floor(microtime(true)))) * 1_000_000) + 1_000);

        $debut = microtime(true);

        // Cinq passages pour un plafond de trois : les deux derniers doivent
        // attendre la seconde suivante.
        foreach (range(1, 5) as $ignored) {
            $cadence->attendreSonTour();
        }

        $this->assertGreaterThan(
            0.3,
            microtime(true) - $debut,
            'les appels au-dela du plafond doivent patienter',
        );
    }

    public function test_une_cle_refusee_n_est_pas_rejouee(): void
    {
        // Rejouer une erreur d'authentification triple la charge sans jamais
        // changer le resultat.
        Http::fake([
            '*/api/v1/balance*' => Http::response(['error' => 'Invalid API key'], 401),
        ]);

        (new ElgiopayGateway(
            config('payments.drivers.elgiopay')
        ))->balance('XAF');

        Http::assertSentCount(1);
    }
}
