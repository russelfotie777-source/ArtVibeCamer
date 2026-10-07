<?php

namespace App\Http\Controllers\Api\V1\Site;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTicketOrderRequest;
use App\Http\Resources\TicketOrderResource;
use App\Http\Resources\TicketTypeResource;
use App\Http\Resources\TransactionResource;
use App\Models\TicketOrder;
use App\Models\TicketType;
use App\Services\Ticketing\TicketingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TicketController extends Controller
{
    public function __construct(private readonly TicketingService $ticketing) {}

    public function types()
    {
        return TicketTypeResource::collection(
            TicketType::query()->active()->ordered()->get()
        );
    }

    public function store(StoreTicketOrderRequest $request): JsonResponse
    {
        $result = $this->ticketing->createOrder(
            $request->validated('items'),
            $request->safe()->only(['buyer_name', 'buyer_phone', 'buyer_email']),
            $request,
        );

        return response()->json([
            'message' => 'Commande enregistrée. Validez le paiement sur votre téléphone pour recevoir vos billets.',
            'order' => TicketOrderResource::make($result->subject),
            'transaction' => TransactionResource::make($result->transaction),
            'payment' => [
                'instructions' => $result->intent->instructions,
                'redirect_url' => $result->intent->redirectUrl,
            ],
        ], 201);
    }

    /**
     * Recuperation des billets par l'acheteur.
     *
     * La reference de commande fait office de secret : elle est aleatoire,
     * communiquee au seul acheteur, et c'est elle qui autorise l'affichage
     * des QR codes.
     */
    public function show(Request $request, TicketOrder $order)
    {
        $order->load(['items.type', 'tickets.type', 'transaction']);

        // Autorise TicketResource a exposer le jeton du QR pour cette reponse.
        $request->attributes->set('expose_qr', $order->isPaid());

        return TicketOrderResource::make($order);
    }
}
