<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Trace de chaque presentation de billet a l'entree, y compris les refus.
 * Sert au comptage des entrees en temps reel et au reglement des litiges.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scan_logs', function (Blueprint $table) {
            $table->id();

            // NULL quand le code scanne ne correspond a aucun billet.
            $table->foreignId('ticket_id')->nullable()->constrained()->nullOnDelete();

            $table->string('raw_code')->nullable();

            $table->enum('result', [
                'accepted',
                'already_used',
                'not_found',
                'cancelled',
                'order_unpaid',
            ])->index();

            $table->foreignId('scanned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('gate')->nullable();          // Entree principale, VIP...
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('scanned_at')->index();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scan_logs');
    }
};
