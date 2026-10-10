<?php

namespace App\Services\Payments\Fulfilment;

use App\Enums\TicketOrderStatus;
use App\Models\Ticket;
use App\Models\TicketOrder;
use App\Models\TicketType;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Commande payee : les billets sont emis, chacun avec son QR code.
 *
 * Les billets n'existent pas avant l'encaissement : un billet en base est,
 * par construction, un billet paye.
 */
class TicketFulfilment implements Fulfilment
{
    public function fulfil(Transaction $transaction): void
    {
        $order = $transaction->payable;

        if (! $order instanceof TicketOrder) {
            Log::error('Billetterie: transaction sans commande rattachee', [
                'transaction' => $transaction->reference,
            ]);

            return;
        }

        // Idempotence : une commande deja payee a deja ses billets emis.
        if ($order->status === TicketOrderStatus::Paid) {
            return;
        }

        foreach ($order->items()->get() as $item) {
            for ($i = 0; $i < $item->quantity; $i++) {
                Ticket::create([
                    'ticket_order_id' => $order->id,
                    'ticket_type_id' => $item->ticket_type_id,
                    'code' => Ticket::generateCode(),
                    'qr_token' => Ticket::generateQrToken(),
                    'holder_name' => $order->buyer_name,
                ]);
            }

            // La reservation devient une vente ferme.
            TicketType::whereKey($item->ticket_type_id)->update([
                'quantity_sold' => DB::raw('quantity_sold + '.(int) $item->quantity),
                'quantity_reserved' => DB::raw(
                    'GREATEST(0, CAST(quantity_reserved AS SIGNED) - '.(int) $item->quantity.')'
                ),
            ]);
        }

        $order->update([
            'status' => TicketOrderStatus::Paid,
            'paid_at' => now(),
            'expires_at' => null,
        ]);
    }

    /** Paiement echoue : la jauge reservee repart a la vente. */
    public function revert(Transaction $transaction): void
    {
        $order = $transaction->payable;

        if (! $order instanceof TicketOrder || $order->status === TicketOrderStatus::Paid) {
            return;
        }

        foreach ($order->items()->get() as $item) {
            TicketType::whereKey($item->ticket_type_id)->update([
                'quantity_reserved' => DB::raw(
                    'GREATEST(0, CAST(quantity_reserved AS SIGNED) - '.(int) $item->quantity.')'
                ),
            ]);
        }

        $order->update(['status' => TicketOrderStatus::Cancelled]);
    }
}
