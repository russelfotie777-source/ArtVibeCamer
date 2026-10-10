<?php

namespace App\Services\Payments\Drivers;

use App\Enums\PaymentMethod;
use App\Enums\TransactionStatus;
use App\Models\Transaction;
use App\Services\Payments\PaymentGateway;
use App\Services\Payments\PaymentIntent;
use App\Services\Payments\PaymentStatus;
use App\Services\Payments\WebhookEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Passerelle de developpement : aucun appel reseau.
 *
 * Permet de derouler inscription, vote et billetterie de bout en bout avant
 * d'avoir les credentials Mobile Money. Encaisse immediatement, sauf si le
 * numero du payeur se termine par le chiffre configure, ce qui permet de
 * tester aussi le parcours "paiement refuse".
 *
 * PaymentManager refuse ce driver des que APP_ENV vaut production.
 */
class FakeGateway implements PaymentGateway
{
    public function __construct(private readonly array $config = []) {}

    public function name(): string
    {
        return 'fake';
    }

    public function isConfigured(): bool
    {
        return true;
    }

    public function initiate(Transaction $transaction): PaymentIntent
    {
        $providerReference = 'FAKE-'.Str::upper(Str::random(12));

        if ($this->shouldFail($transaction->payer_phone)) {
            return new PaymentIntent(
                status: TransactionStatus::Failed,
                providerReference: $providerReference,
                failureReason: 'Solde insuffisant (simulation)',
                raw: ['simulated' => true],
            );
        }

        return new PaymentIntent(
            status: TransactionStatus::Succeeded,
            providerReference: $providerReference,
            instructions: 'Paiement simulé : aucun débit réel.',
            raw: ['simulated' => true],
        );
    }

    public function verify(Transaction $transaction): PaymentStatus
    {
        return new PaymentStatus(
            status: $this->shouldFail($transaction->payer_phone)
                ? TransactionStatus::Failed
                : TransactionStatus::Succeeded,
            providerReference: $transaction->provider_reference,
            method: $transaction->payer_phone
                ? PaymentMethod::fromCameroonPhone($transaction->payer_phone)
                : null,
            payerPhone: $transaction->payer_phone,
            amount: $transaction->amount,
            raw: ['simulated' => true],
        );
    }

    /**
     * Accepte une notification forgee par la route de simulation, pour pouvoir
     * exercer le chemin webhook (idempotence, signature, fulfilment) en local.
     */
    public function parseWebhook(Request $request): WebhookEvent
    {
        $reference = $request->input('reference');
        $status = $request->input('status', 'succeeded');

        $mapped = match ($status) {
            'succeeded', 'success' => TransactionStatus::Succeeded,
            'failed' => TransactionStatus::Failed,
            'cancelled' => TransactionStatus::Cancelled,
            default => TransactionStatus::Processing,
        };

        return new WebhookEvent(
            signatureValid: true,
            eventId: $request->input('event_id', 'FAKE-EVT-'.Str::upper(Str::random(12))),
            transactionReference: $reference,
            providerReference: $request->input('provider_reference'),
            status: new PaymentStatus(
                status: $mapped,
                providerReference: $request->input('provider_reference'),
                raw: $request->all(),
            ),
            payload: $request->all(),
        );
    }

    private function shouldFail(?string $phone): bool
    {
        $suffix = $this->config['failing_phone_suffix'] ?? null;

        return $suffix !== null
            && $phone !== null
            && str_ends_with(preg_replace('/\D/', '', $phone) ?? '', (string) $suffix);
    }
}
