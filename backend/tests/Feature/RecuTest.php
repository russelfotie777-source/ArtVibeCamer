<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Transaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Recu de paiement.
 *
 * Un recu atteste d'un encaissement : il ne doit exister que si l'argent est
 * arrive, et rester accessible au seul porteur de la reference.
 */
class RecuTest extends TestCase
{
    use RefreshDatabase, TestSupport;

    private int $rang = 0;

    private function transaction(TransactionStatus $statut): Transaction
    {
        // Le slug de categorie est unique en base : un appel par scenario.
        $this->rang++;
        $category = $this->makeCategory([
            'name' => 'Categorie '.$this->rang,
            'slug' => 'categorie-'.$this->rang,
        ]);
        // Email et telephone sont uniques en base, comme pour de vrais
        // candidats : chaque scenario a donc les siens.
        $candidate = $this->makeCandidate($category, [
            'email' => 'payeur'.$this->rang.'@example.cm',
            'phone' => '23767123456'.$this->rang,
        ]);

        $transaction = Transaction::create([
            'reference' => Transaction::generateReference(TransactionType::Registration),
            'type' => TransactionType::Registration,
            'payable_type' => $candidate->getMorphClass(),
            'payable_id' => $candidate->id,
            'amount' => 8000,
            'currency' => 'XAF',
            'status' => $statut,
            'payer_name' => 'Arnaud Nkolo',
            'payer_phone' => '677000000',
        ]);

        /*
         * `paid_at` est volontairement hors de $fillable : une date
         * d'encaissement ne doit jamais venir d'une requete. On l'ecrit donc
         * comme le fait le service de paiement, et non par assignation de
         * masse — ce que le modele refuse, a juste titre.
         */
        if ($statut === TransactionStatus::Succeeded) {
            $transaction->forceFill(['paid_at' => now()])->save();
        }

        return $transaction;
    }

    public function test_un_paiement_abouti_donne_un_recu_en_pdf(): void
    {
        $transaction = $this->transaction(TransactionStatus::Succeeded);

        $reponse = $this->get("/api/v1/payments/{$transaction->reference}/recu");

        $reponse->assertOk();
        $reponse->assertHeader('content-type', 'application/pdf');

        // Un PDF commence par cette signature : on verifie qu'un document est
        // bien produit, pas seulement qu'une reponse revient.
        $this->assertStringStartsWith('%PDF-', $reponse->getContent());
    }

    /**
     * Delivrer un recu sur un paiement en cours laisserait croire a un
     * encaissement qui n'a pas eu lieu — et servirait de preuve a qui n'a
     * rien paye.
     */
    public function test_aucun_recu_tant_que_le_paiement_n_a_pas_abouti(): void
    {
        foreach ([TransactionStatus::Processing, TransactionStatus::Failed] as $statut) {
            $transaction = $this->transaction($statut);

            $this->get("/api/v1/payments/{$transaction->reference}/recu")
                ->assertNotFound();
        }
    }
}
