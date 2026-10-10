<?php

namespace App\Services\Ticketing;

use App\Enums\PaymentMethod;
use App\Enums\TicketOrderStatus;
use App\Enums\TransactionType;
use App\Models\TicketOrder;
use App\Models\TicketOrderItem;
use App\Models\TicketType;
use App\Models\Transaction;
use App\Services\Payments\CheckoutResult;
use App\Services\Payments\PaymentProcessor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Vente de billets.
 *
 * Les places sont reservees des la creation de la commande et liberees si le
 * paiement n'aboutit pas. Sans cette reservation, deux acheteurs payant en
 * meme temps les dernieres places seraient tous les deux encaisses, ce qui
 * obligerait a rembourser l'un des deux le soir de l'evenement.
 */
class TicketingService
{
    public function __construct(private readonly PaymentProcessor $payments) {}

    /**
     * @param  array<int, array{ticket_type_id: int, quantity: int}>  $items
     */
    public function createOrder(array $items, array $buyer, Request $request): CheckoutResult
    {
        if ($items === []) {
            throw ValidationException::withMessages([
                'items' => 'Sélectionnez au moins un billet.',
            ]);
        }

        [$order, $transaction] = DB::transaction(function () use ($items, $buyer, $request) {
            $lines = [];
            $total = 0;
            $quantity = 0;

            // Verrou sur les types de place concernes, dans un ordre stable
            // (tri par identifiant) pour eviter les interblocages entre deux
            // commandes portant sur les memes categories.
            $typeIds = collect($items)->pluck('ticket_type_id')->unique()->sort()->values();

            $types = TicketType::query()
                ->whereIn('id', $typeIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            foreach ($items as $item) {
                $type = $types->get($item['ticket_type_id']);
                $wanted = (int) $item['quantity'];

                if ($type === null) {
                    throw ValidationException::withMessages([
                        'items' => 'Catégorie de billet inconnue.',
                    ]);
                }

                if ($wanted < 1) {
                    continue;
                }

                if (! $type->isOnSale()) {
                    throw ValidationException::withMessages([
                        'items' => "Les billets « {$type->name} » ne sont pas en vente.",
                    ]);
                }

                $available = $type->availableQuantity();

                if ($available !== null && $wanted > $available) {
                    throw ValidationException::withMessages([
                        'items' => $available === 0
                            ? "Les billets « {$type->name} » sont épuisés."
                            : "Il ne reste que {$available} billet(s) « {$type->name} ».",
                    ]);
                }

                if ($wanted > $type->max_per_order) {
                    throw ValidationException::withMessages([
                        'items' => "Maximum {$type->max_per_order} billet(s) « {$type->name} » par commande.",
                    ]);
                }

                // Tarif fige a la commande.
                $subtotal = $type->price * $wanted;
                $total += $subtotal;
                $quantity += $wanted;

                $lines[] = [
                    'ticket_type_id' => $type->id,
                    'quantity' => $wanted,
                    'unit_price' => $type->price,
                    'subtotal' => $subtotal,
                ];

                $type->increment('quantity_reserved', $wanted);
            }

            if ($lines === []) {
                throw ValidationException::withMessages([
                    'items' => 'Sélectionnez au moins un billet.',
                ]);
            }

            $this->assertAmountWithinBounds($total);

            $order = TicketOrder::create([
                'reference' => TicketOrder::generateReference(),
                'buyer_name' => $buyer['buyer_name'],
                'buyer_phone' => $buyer['buyer_phone'],
                'buyer_email' => $buyer['buyer_email'] ?? null,
                'quantity' => $quantity,
                'total_amount' => $total,
                'status' => TicketOrderStatus::Pending,
                'expires_at' => now()->addMinutes((int) config('payments.payment_timeout_minutes')),
                'ip_address' => $request->ip(),
            ]);

            foreach ($lines as $line) {
                TicketOrderItem::create([...$line, 'ticket_order_id' => $order->id]);
            }

            $transaction = Transaction::create([
                'reference' => Transaction::generateReference(TransactionType::Ticket),
                'type' => TransactionType::Ticket,
                'payable_type' => $order->getMorphClass(),
                'payable_id' => $order->id,
                'amount' => $total,
                'currency' => config('payments.currency'),
                'payer_name' => $order->buyer_name,
                'payer_phone' => $order->buyer_phone,
                'payer_email' => $order->buyer_email,
                'payment_method' => PaymentMethod::fromCameroonPhone($order->buyer_phone),
                'expires_at' => $order->expires_at,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            $order->update(['transaction_id' => $transaction->id]);

            return [$order, $transaction];
        });

        $intent = $this->payments->start($transaction);

        return new CheckoutResult(
            $order->refresh()->load('items.type'),
            $transaction->refresh(),
            $intent,
        );
    }

    private function assertAmountWithinBounds(int $amount): void
    {
        if ($amount < (int) config('payments.min_amount')
            || $amount > (int) config('payments.max_amount')) {
            throw ValidationException::withMessages([
                'items' => 'Le montant total dépasse les limites autorisées.',
            ]);
        }
    }
}
