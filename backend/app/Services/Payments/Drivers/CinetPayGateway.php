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
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * CinetPay - page de paiement hebergee (MoMo, Orange Money, carte).
 *
 * Parcours : on cree un paiement, on redirige le payeur vers `payment_url`,
 * et CinetPay notifie notre webhook. La notification ne contient pas le
 * resultat de facon fiable : on rappelle systematiquement /payment/check,
 * ce qui est la recommandation de l'editeur contre les notifications forgees.
 *
 * ATTENTION : chemins et champs a reverifier sur la documentation en vigueur
 * avant la mise en production.
 */
class CinetPayGateway implements PaymentGateway
{
    public function __construct(private readonly array $config) {}

    public function name(): string
    {
        return 'cinetpay';
    }

    public function isConfigured(): bool
    {
        return filled($this->config['site_id'] ?? null)
            && filled($this->config['api_key'] ?? null);
    }

    public function initiate(Transaction $transaction): PaymentIntent
    {
        $response = Http::baseUrl(rtrim($this->config['base_url'], '/'))
            ->acceptJson()
            ->timeout(30)
            ->post('/v2/payment', [
                'apikey' => $this->config['api_key'],
                'site_id' => $this->config['site_id'],
                'transaction_id' => $transaction->reference,
                'amount' => $transaction->amount,
                'currency' => $transaction->currency,
                'description' => $transaction->type->label(),
                'customer_name' => $transaction->payer_name,
                'customer_phone_number' => $transaction->payer_phone,
                'customer_email' => $transaction->payer_email,
                'channels' => 'ALL',
                'notify_url' => route('webhooks.payments', ['provider' => 'cinetpay']),
                'return_url' => rtrim((string) config('app.frontend_url'), '/')
                    .'/paiement/'.$transaction->reference,
            ]);

        $body = $response->json() ?? [];

        if ($response->failed() || ($body['code'] ?? null) !== '201') {
            Log::warning('CinetPay: echec de creation du paiement', [
                'transaction' => $transaction->reference,
                'code' => $body['code'] ?? $response->status(),
            ]);

            return new PaymentIntent(
                status: TransactionStatus::Failed,
                failureReason: $body['message'] ?? 'Le paiement n\'a pas pu être lancé.',
                raw: $this->scrub($body),
            );
        }

        return new PaymentIntent(
            status: TransactionStatus::Processing,
            providerReference: $body['data']['payment_token'] ?? null,
            redirectUrl: $body['data']['payment_url'] ?? null,
            raw: $this->scrub($body),
        );
    }

    public function verify(Transaction $transaction): PaymentStatus
    {
        $response = Http::baseUrl(rtrim($this->config['base_url'], '/'))
            ->acceptJson()
            ->timeout(30)
            ->post('/v2/payment/check', [
                'apikey' => $this->config['api_key'],
                'site_id' => $this->config['site_id'],
                'transaction_id' => $transaction->reference,
            ]);

        $body = $response->json() ?? [];

        if ($response->failed()) {
            return new PaymentStatus(
                status: $transaction->status,
                failureReason: 'Passerelle injoignable.',
                raw: $this->scrub($body),
            );
        }

        return $this->toStatus($body);
    }

    /**
     * La notification sert uniquement de declencheur : seul /payment/check
     * fait foi. On renvoie donc l'etat issu de la verification serveur a serveur.
     */
    public function parseWebhook(Request $request): WebhookEvent
    {
        $payload = $request->all();
        $reference = $payload['cpm_trans_id'] ?? null;

        $status = null;

        if ($reference !== null) {
            $response = Http::baseUrl(rtrim($this->config['base_url'], '/'))
                ->acceptJson()
                ->timeout(30)
                ->post('/v2/payment/check', [
                    'apikey' => $this->config['api_key'],
                    'site_id' => $this->config['site_id'],
                    'transaction_id' => $reference,
                ]);

            if ($response->successful()) {
                $status = $this->toStatus($response->json() ?? []);
            }
        }

        return new WebhookEvent(
            // L'authenticite vient de la re-verification serveur a serveur,
            // pas du contenu de la notification.
            signatureValid: $status !== null,
            eventId: $reference !== null ? 'cinetpay:'.$reference : null,
            transactionReference: $reference,
            providerReference: $payload['cpm_payid'] ?? null,
            status: $status,
            payload: $this->scrub($payload),
        );
    }

    private function toStatus(array $body): PaymentStatus
    {
        $data = $body['data'] ?? [];
        $raw = strtoupper((string) ($data['status'] ?? $body['code'] ?? ''));

        $status = match ($raw) {
            'ACCEPTED', '00' => TransactionStatus::Succeeded,
            'REFUSED' => TransactionStatus::Failed,
            'CANCELED', 'CANCELLED' => TransactionStatus::Cancelled,
            'WAITING_FOR_CUSTOMER', 'PENDING' => TransactionStatus::Processing,
            default => TransactionStatus::Processing,
        };

        $operator = strtoupper((string) ($data['payment_method'] ?? ''));

        return new PaymentStatus(
            status: $status,
            providerReference: $data['payment_token'] ?? $data['cpm_payid'] ?? null,
            method: match (true) {
                str_contains($operator, 'MTN') || str_contains($operator, 'MOMO') => PaymentMethod::MtnMomo,
                str_contains($operator, 'OM') || str_contains($operator, 'ORANGE') => PaymentMethod::OrangeMoney,
                str_contains($operator, 'CARD') || str_contains($operator, 'VISA') => PaymentMethod::Card,
                default => null,
            },
            payerPhone: $data['phone_number'] ?? null,
            amount: isset($data['amount']) ? (int) $data['amount'] : null,
            failureReason: $data['message'] ?? $body['message'] ?? null,
            raw: $this->scrub($body),
        );
    }

    private function scrub(array $payload): array
    {
        return collect($payload)
            ->except(['apikey', 'api_key', 'secret_key', 'site_id'])
            ->all();
    }
}
