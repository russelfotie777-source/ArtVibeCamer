<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Detail d'une commande : quelle categorie de place, en quelle quantite.
 *
 * Indispensable avant paiement : les billets ne sont emis qu'une fois
 * l'encaissement confirme, c'est donc cette table qui dit quoi emettre et
 * quelle jauge liberer si la commande expire.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ticket_order_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('ticket_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('ticket_type_id')->constrained()->restrictOnDelete();

            $table->unsignedSmallInteger('quantity');

            // Tarif figé au moment de la commande : un changement de prix
            // ulterieur ne doit pas reecrire l'historique des ventes.
            $table->unsignedInteger('unit_price');
            $table->unsignedInteger('subtotal');

            $table->timestamps();

            $table->unique(['ticket_order_id', 'ticket_type_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_order_items');
    }
};
