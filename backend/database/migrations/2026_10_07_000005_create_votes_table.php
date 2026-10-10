<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Un enregistrement = un achat de N votes pour un candidat.
 *
 * On ne cree pas une ligne par voix : a 12 500 votes attendus et des lots
 * de plusieurs voix, le lot garde la trace commerciale (montant paye,
 * payeur, transaction) tout en restant agregeable.
 *
 * Seules les lignes `confirmed` comptent dans les classements.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('votes', function (Blueprint $table) {
            $table->id();

            $table->string('reference', 40)->unique();

            $table->foreignId('candidate_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();

            // Denormalise depuis le candidat : evite une jointure sur tous les
            // agregats par categorie du tableau de bord.
            $table->foreignId('category_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();

            $table->foreignId('transaction_id')->nullable()->constrained()->nullOnDelete();

            $table->unsignedInteger('quantity');
            $table->unsignedInteger('unit_price');
            $table->unsignedInteger('total_amount');

            $table->string('voter_name')->nullable();
            $table->string('voter_phone', 20)->nullable()->index();
            $table->string('voter_email')->nullable();

            $table->enum('status', ['pending', 'confirmed', 'failed', 'cancelled'])
                ->default('pending')
                ->index();

            $table->timestamp('confirmed_at')->nullable();

            // Annulation manuelle d'un lot juge frauduleux : decremente le compteur
            // du candidat et conserve la justification.
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancellation_reason')->nullable();

            // Signaux anti-fraude conserves pour analyse a posteriori.
            $table->string('ip_address', 45)->nullable()->index();
            $table->text('user_agent')->nullable();
            $table->string('fingerprint', 64)->nullable()->index();

            $table->timestamps();

            // Total des voix d'un candidat et courbe d'evolution des votes.
            $table->index(['candidate_id', 'status', 'confirmed_at'], 'votes_tally_index');
            $table->index(['category_id', 'status'], 'votes_category_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('votes');
    }
};
