<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Commande = un panier paye en une fois. Les billets individuels (avec leur
 * QR code) ne sont emis qu'apres confirmation du paiement.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ticket_orders', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 40)->unique();

            $table->foreignId('transaction_id')->nullable()->constrained()->nullOnDelete();

            $table->string('buyer_name');
            $table->string('buyer_phone', 20)->index();
            $table->string('buyer_email')->nullable();

            $table->unsignedInteger('quantity');
            $table->unsignedInteger('total_amount');

            $table->enum('status', ['pending', 'paid', 'cancelled', 'expired', 'refunded'])
                ->default('pending')
                ->index();

            $table->timestamp('paid_at')->nullable();

            // Liberation de la jauge reservee si le paiement n'aboutit pas.
            $table->timestamp('expires_at')->nullable()->index();

            // Suivi des envois du billet au client.
            $table->timestamp('delivered_at')->nullable();
            $table->enum('delivery_channel', ['email', 'whatsapp', 'download'])->nullable();

            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_orders');
    }
};
