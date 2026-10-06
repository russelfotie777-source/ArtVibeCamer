<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Toute notification entrante de passerelle est d'abord persistee ici, telle
 * quelle, avant tout traitement metier.
 *
 * Deux raisons : les passerelles Mobile Money rejouent les notifications
 * jusqu'a obtenir un 2xx (d'ou `event_id` unique pour l'idempotence), et en cas
 * de litige sur un encaissement le payload brut est la seule preuve.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_webhooks', function (Blueprint $table) {
            $table->id();

            $table->string('provider', 30)->index();

            // Identifiant d'evenement fourni par la passerelle. Unique : un rejeu
            // est accepte avec un 200 mais n'est jamais retraite.
            $table->string('event_id')->nullable()->unique();

            $table->string('provider_reference')->nullable()->index();

            $table->boolean('signature_valid')->default(false)->index();

            $table->json('headers')->nullable();
            $table->json('payload');

            $table->foreignId('transaction_id')->nullable()->constrained()->nullOnDelete();

            $table->timestamp('processed_at')->nullable()->index();
            $table->text('error')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);

            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_webhooks');
    }
};
