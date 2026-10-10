<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('cover_image')->nullable();

            // Montants en FCFA. XAF n'a pas de sous-unite : on stocke des entiers.
            $table->unsignedInteger('registration_fee');
            $table->unsignedInteger('vote_price');

            $table->unsignedSmallInteger('max_candidates')->nullable();

            // Fenetres d'ouverture. NULL = on retombe sur les reglages globaux.
            $table->timestamp('registration_opens_at')->nullable();
            $table->timestamp('registration_closes_at')->nullable();
            $table->timestamp('voting_opens_at')->nullable();
            $table->timestamp('voting_closes_at')->nullable();

            // Compteurs denormalises : le classement public est lu en permanence,
            // on ne veut pas un COUNT/SUM sur votes a chaque affichage.
            $table->unsignedInteger('candidates_count')->default(0);
            $table->unsignedBigInteger('votes_count')->default(0);

            $table->boolean('is_active')->default(true)->index();
            $table->unsignedSmallInteger('display_order')->default(0)->index();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
