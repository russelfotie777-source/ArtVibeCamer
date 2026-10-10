<?php

namespace Tests\Feature;

use App\Enums\TicketOrderStatus;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\TicketOrder;
use App\Models\TicketType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TicketingTest extends TestCase
{
    use RefreshDatabase, TestSupport;

    public function test_une_commande_payee_emet_les_billets(): void
    {
        $standard = $this->makeTicketType(['name' => 'Standard', 'price' => 5000]);
        $vip = $this->makeTicketType(['name' => 'VIP', 'price' => 15000, 'quantity_total' => 50]);

        $this->postJson('/api/v1/ticket-orders', [
            'items' => [
                ['ticket_type_id' => $vip->id, 'quantity' => 2],
                ['ticket_type_id' => $standard->id, 'quantity' => 1],
            ],
            'buyer_name' => 'Serge Etoa',
            'buyer_phone' => '677112233',
        ])->assertCreated();

        $order = TicketOrder::firstOrFail();

        $this->assertSame(TicketOrderStatus::Paid, $order->status);
        $this->assertSame(35000, $order->total_amount);
        $this->assertSame(3, $order->tickets()->count());

        // La reservation est devenue une vente ferme.
        $this->assertSame(2, $vip->fresh()->quantity_sold);
        $this->assertSame(0, $vip->fresh()->quantity_reserved);

        // Chaque billet porte un code et un jeton uniques.
        $tickets = Ticket::all();
        $this->assertCount(3, $tickets->pluck('code')->unique());
        $this->assertCount(3, $tickets->pluck('qr_token')->unique());
    }

    public function test_un_paiement_refuse_n_emet_aucun_billet_et_libere_la_jauge(): void
    {
        $type = $this->makeTicketType(['quantity_total' => 10]);

        // Numero finissant par 0 : la simulation refuse le paiement.
        $this->postJson('/api/v1/ticket-orders', [
            'items' => [['ticket_type_id' => $type->id, 'quantity' => 4]],
            'buyer_name' => 'Test',
            'buyer_phone' => '677112230',
        ])->assertCreated();

        $this->assertDatabaseCount('tickets', 0);
        $this->assertSame(TicketOrderStatus::Cancelled, TicketOrder::firstOrFail()->status);

        $fresh = $type->fresh();
        $this->assertSame(0, $fresh->quantity_sold);
        $this->assertSame(0, $fresh->quantity_reserved);
        $this->assertSame(10, $fresh->availableQuantity());
    }

    public function test_la_jauge_ne_peut_pas_etre_depassee(): void
    {
        $type = $this->makeTicketType(['quantity_total' => 5, 'max_per_order' => 20]);

        $this->postJson('/api/v1/ticket-orders', [
            'items' => [['ticket_type_id' => $type->id, 'quantity' => 8]],
            'buyer_name' => 'Test',
            'buyer_phone' => '677112233',
        ])->assertStatus(422)->assertJsonValidationErrors('items');

        $this->assertDatabaseCount('ticket_orders', 0);
    }

    public function test_le_plafond_par_commande_est_applique(): void
    {
        $type = $this->makeTicketType(['quantity_total' => 100, 'max_per_order' => 4]);

        $this->postJson('/api/v1/ticket-orders', [
            'items' => [['ticket_type_id' => $type->id, 'quantity' => 10]],
            'buyer_name' => 'Test',
            'buyer_phone' => '677112233',
        ])->assertStatus(422);
    }

    public function test_le_tarif_est_fige_a_la_commande(): void
    {
        $type = $this->makeTicketType(['price' => 5000]);

        $this->postJson('/api/v1/ticket-orders', [
            'items' => [['ticket_type_id' => $type->id, 'quantity' => 2]],
            'buyer_name' => 'Test',
            'buyer_phone' => '677112233',
        ])->assertCreated();

        // Un changement de tarif ne doit pas reecrire l'historique des ventes.
        TicketType::whereKey($type->id)->update(['price' => 9000]);

        $order = TicketOrder::firstOrFail();
        $this->assertSame(10000, $order->total_amount);
        $this->assertSame(5000, $order->items()->firstOrFail()->unit_price);
    }

    public function test_un_billet_ne_peut_etre_scanne_qu_une_fois(): void
    {
        $type = $this->makeTicketType();
        $agent = $this->makeUser(UserRole::Scanner);

        $this->postJson('/api/v1/ticket-orders', [
            'items' => [['ticket_type_id' => $type->id, 'quantity' => 1]],
            'buyer_name' => 'Test',
            'buyer_phone' => '677112233',
        ])->assertCreated();

        $ticket = Ticket::firstOrFail();

        $first = $this->actingAs($agent, 'sanctum')
            ->postJson('/api/v1/admin/scan', ['code' => $ticket->qr_token, 'gate' => 'Entree principale']);

        $first->assertOk()->assertJsonPath('granted', true)->assertJsonPath('result', 'accepted');

        $second = $this->actingAs($agent, 'sanctum')
            ->postJson('/api/v1/admin/scan', ['code' => $ticket->qr_token]);

        $second->assertOk()->assertJsonPath('granted', false)->assertJsonPath('result', 'already_used');

        $this->assertSame(TicketStatus::Used, $ticket->fresh()->status);
        $this->assertSame(2, $ticket->fresh()->scan_count);

        // Chaque presentation est tracee, acceptee comme refusee.
        $this->assertDatabaseCount('scan_logs', 2);
    }

    public function test_un_code_inconnu_est_refuse_et_journalise(): void
    {
        $agent = $this->makeUser(UserRole::Scanner);

        $this->actingAs($agent, 'sanctum')
            ->postJson('/api/v1/admin/scan', ['code' => 'AVC-T-ZZZZZZ'])
            ->assertOk()
            ->assertJsonPath('granted', false)
            ->assertJsonPath('result', 'not_found');

        $this->assertDatabaseCount('scan_logs', 1);
    }

    public function test_le_jeton_qr_n_est_pas_expose_dans_la_liste_publique(): void
    {
        $this->makeTicketType();

        $this->getJson('/api/v1/ticket-types')
            ->assertOk()
            ->assertJsonMissingPath('data.0.quantity_total')
            ->assertJsonMissingPath('data.0.quantity_sold');
    }
}
