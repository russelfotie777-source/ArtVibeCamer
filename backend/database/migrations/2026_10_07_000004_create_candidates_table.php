<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidates', function (Blueprint $table) {
            $table->id();

            $table->foreignId('category_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();

            // Numero de scene affiche au public et utilise pour voter.
            // Attribue seulement quand l'inscription est payee, d'ou le nullable.
            // Format : AVC-<CODE CATEGORIE>-<3 CHIFFRES>  ex. AVC-MUS-014
            $table->string('candidate_number', 20)->nullable()->unique();

            $table->string('first_name');
            $table->string('last_name');
            $table->string('stage_name')->nullable();
            $table->string('slug')->unique();

            $table->string('email');
            $table->string('phone', 20);
            $table->string('whatsapp', 20)->nullable();

            $table->string('city')->nullable();
            $table->string('region')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->date('date_of_birth')->nullable();

            $table->string('photo_path')->nullable();
            $table->text('presentation')->nullable();

            // { facebook, instagram, tiktok, youtube, x }
            $table->json('socials')->nullable();

            $table->enum('status', [
                'draft',             // formulaire entame, paiement pas encore lance
                'awaiting_payment',  // en attente d'encaissement des frais
                'pending_review',    // paye, a valider par l'organisation
                'active',            // valide, visible et votable
                'rejected',
                'withdrawn',
                'eliminated',
            ])->default('draft')->index();

            $table->foreignId('registration_transaction_id')
                ->nullable()
                ->constrained('transactions')
                ->nullOnDelete();

            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('rejection_reason')->nullable();

            // Compteur denormalise, incremente uniquement a la confirmation d'un
            // paiement de vote. Source de verite recalculable depuis `votes`.
            $table->unsignedBigInteger('votes_count')->default(0);

            $table->boolean('is_featured')->default(false)->index();

            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Anti-doublon d'inscription demande par l'organisation.
            // Unique global plutot que par categorie : un meme artiste ne doit pas
            // pouvoir s'inscrire deux fois en changeant simplement de categorie.
            $table->unique('email', 'candidates_email_unique');
            $table->unique('phone', 'candidates_phone_unique');

            // Classement public d'une categorie.
            $table->index(['category_id', 'status', 'votes_count'], 'candidates_ranking_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidates');
    }
};
