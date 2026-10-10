<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Journal unique de tous les encaissements : inscriptions, votes, tickets.
 *
 * Choix structurant : une seule table pour les trois flux. Les recettes
 * consolidees du tableau de bord se lisent alors avec un seul GROUP BY,
 * et la reconciliation avec les releves de l'operateur Mobile Money
 * se fait au meme endroit.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();

            // Reference lisible communiquee au payeur et utilisee en support.
            // Format : AVC-<TYPE>-<ANNEE>-<8 CARACTERES>  ex. AVC-VOT-2026-7F3K9A2B
            $table->string('reference', 40)->unique();

            $table->enum('type', ['registration', 'vote', 'ticket'])->index();

            // Cible payee : Candidate, Vote ou TicketOrder.
            $table->nullableMorphs('payable');

            $table->unsignedInteger('amount');
            $table->string('currency', 3)->default('XAF');

            $table->enum('status', [
                'pending',     // creee, paiement pas encore lance
                'processing',  // passerelle sollicitee, USSD envoye au payeur
                'succeeded',   // encaissement confirme par webhook ou verification
                'failed',
                'cancelled',
                'expired',
                'refunded',
            ])->default('pending')->index();

            $table->string('provider', 30)->default('fake');
            $table->string('provider_reference')->nullable()->index();
            $table->enum('payment_method', ['mtn_momo', 'orange_money', 'card', 'bank', 'cash', 'manual'])
                ->nullable();

            $table->string('payer_name')->nullable();
            $table->string('payer_phone', 20)->nullable()->index();
            $table->string('payer_email')->nullable();

            // Garde-fou contre le double encaissement si l'utilisateur
            // re-soumet le formulaire ou rafraichit la page de paiement.
            $table->string('idempotency_key', 64)->nullable()->unique();

            $table->timestamp('processing_at')->nullable();
            $table->timestamp('paid_at')->nullable()->index();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();

            $table->string('failure_reason')->nullable();

            // Echanges bruts avec la passerelle, secrets retires avant ecriture.
            $table->json('metadata')->nullable();

            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();

            $table->timestamps();

            // Recettes par type sur une periode : requete la plus frequente du dashboard.
            $table->index(['type', 'status', 'paid_at'], 'transactions_reporting_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
