<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ticket_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');               // Standard, VIP, VVIP, Table
            $table->string('slug')->unique();
            $table->text('description')->nullable();

            $table->unsignedInteger('price');     // FCFA

            // NULL = jauge illimitee. Sinon quantity_sold ne doit jamais depasser.
            $table->unsignedInteger('quantity_total')->nullable();
            $table->unsignedInteger('quantity_sold')->default(0);

            // Reservation temporaire pendant qu'un paiement est en cours, pour ne
            // pas survendre la jauge si plusieurs acheteurs arrivent en meme temps.
            $table->unsignedInteger('quantity_reserved')->default(0);

            $table->unsignedSmallInteger('max_per_order')->default(10);

            $table->timestamp('sales_opens_at')->nullable();
            $table->timestamp('sales_closes_at')->nullable();

            $table->boolean('is_active')->default(true)->index();
            $table->unsignedSmallInteger('display_order')->default(0)->index();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_types');
    }
};
