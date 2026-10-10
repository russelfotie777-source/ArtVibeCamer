<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Un billet nominatif par place achetee, porteur de son propre QR code.
 *
 * Le controle a l'entree repose sur `qr_token` (256 bits aleatoires, unique).
 * Le passage de `valid` a `used` se fait par un UPDATE conditionnel pour que
 * deux scans simultanes du meme billet ne puissent pas tous les deux reussir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();

            $table->foreignId('ticket_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('ticket_type_id')->constrained()->restrictOnDelete();

            // Code court dictable par telephone en cas de QR illisible.
            // Format : AVC-T-7F3K9A
            $table->string('code', 20)->unique();

            // Charge utile du QR code. Jamais devinable, jamais sequentielle.
            $table->string('qr_token', 64)->unique();

            $table->string('holder_name')->nullable();

            $table->enum('status', ['valid', 'used', 'cancelled'])->default('valid')->index();

            $table->timestamp('used_at')->nullable();
            $table->foreignId('used_by')->nullable()->constrained('users')->nullOnDelete();

            // Nombre de presentations du billet, y compris les refus.
            // Plusieurs tentatives apres un premier passage = signal de fraude.
            $table->unsignedSmallInteger('scan_count')->default(0);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
