<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Commission de la passerelle.
 *
 * Le tableau de bord additionnait le brut — ce que le candidat a paye — et le
 * presentait comme la recette. L'organisation touche en realite le net, la
 * passerelle prelevant sa commission a l'encaissement (2 % constates chez
 * Elgiopay). Sur un evenement qui rend des comptes a un organisateur et a des
 * sponsors, l'ecart se decouvre au mauvais moment.
 *
 * Les deux colonnes restent nullables : la passerelle de simulation ne
 * produit pas de frais, et les transactions anterieures n'en ont pas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->unsignedInteger('fees')->nullable()->after('amount');
            $table->unsignedInteger('net_amount')->nullable()->after('fees');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn(['fees', 'net_amount']);
        });
    }
};
