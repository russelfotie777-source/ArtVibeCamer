<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Inscription en groupe.
 *
 * Un candidat peut se presenter seul ou en formation. Le tarif differe, et un
 * groupe doit declarer ses membres : c'est la liste qui sert au controle le
 * jour du casting.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            /*
             * registration_fee reste le tarif individuel.
             * group_fee a NULL signifie que la categorie n'accepte pas les
             * groupes — cas de Miss & Master, ou le concours est par nature
             * individuel.
             */
            $table->unsignedInteger('group_fee')->nullable()->after('registration_fee');
            $table->unsignedTinyInteger('max_group_members')->default(12)->after('group_fee');
            $table->string('tagline')->nullable()->after('description');
        });

        Schema::table('candidates', function (Blueprint $table) {
            $table->enum('registration_type', ['solo', 'group'])
                ->default('solo')
                ->after('category_id')
                ->index();

            // Nom de scene de la formation. C'est lui qui est affiche au
            // public quand l'inscription est un groupe.
            $table->string('group_name')->nullable()->after('stage_name');

            // Denormalise depuis candidate_members : evite un COUNT sur chaque
            // ligne des listes du back-office.
            $table->unsignedTinyInteger('members_count')->default(0)->after('group_name');
        });

        // L'email devient facultatif : beaucoup de candidats n'en ont pas, et
        // le telephone suffit a les joindre. MySQL autorise plusieurs NULL
        // dans un index unique, la contrainte anti-doublon reste donc valable
        // pour ceux qui en fournissent un.
        Schema::table('candidates', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            $table->dropIndex(['registration_type']);
            $table->dropColumn(['registration_type', 'group_name', 'members_count']);
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn(['group_fee', 'max_group_members', 'tagline']);
        });
    }
};
