<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Membres d'une inscription en groupe.
 *
 * La liste est declaree a l'inscription et sert au controle a l'entree du
 * casting : on verifie que les personnes presentes sont bien celles
 * annoncees. La photo est facultative, tous les candidats n'en ayant pas
 * une sous la main au moment de s'inscrire.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidate_members', function (Blueprint $table) {
            $table->id();

            $table->foreignId('candidate_id')->constrained()->cascadeOnDelete();

            $table->string('full_name');
            $table->string('photo_path')->nullable();

            // Ordre d'affichage, tel que saisi dans le formulaire.
            $table->unsignedTinyInteger('position')->default(0);

            $table->timestamps();

            $table->index(['candidate_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_members');
    }
};
