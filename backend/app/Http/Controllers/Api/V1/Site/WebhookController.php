<?php

namespace App\Http\Controllers\Api\V1\Site;

use App\Http\Controllers\Controller;
use App\Services\Payments\PaymentProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class WebhookController extends Controller
{
    public function __construct(private readonly PaymentProcessor $payments) {}

    /**
     * Point d'entree des notifications de paiement.
     *
     * Repond systematiquement 200, y compris sur rejet : une passerelle qui
     * recoit une erreur rejoue indefiniment la meme notification. Le detail
     * de ce qui s'est passe est consigne dans `payment_webhooks`, pas renvoye
     * a l'appelant, qui n'est pas authentifie.
     */
    public function handle(Request $request, string $provider): JsonResponse
    {
        try {
            $this->payments->handleWebhook($provider, $request);
        } catch (Throwable $e) {
            report($e);
        }

        return response()->json(['received' => true]);
    }
}
