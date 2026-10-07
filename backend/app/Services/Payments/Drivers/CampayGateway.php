<?php

namespace App\Services\Payments\Drivers;

use App\Enums\PaymentMethod;
use App\Enums\TransactionStatus;
use App\Models\Transaction;
use App\Services\Payments\PaymentGateway;
use App\Services\Payments\PaymentIntent;
use App\Services\Payments\PaymentStatus;
use App\Services\Payments\WebhookEvent;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Campay - collecte MTN MoMo et Orange Money par USSD direct.
 *
 * Parcours : on declenche la collecte, l'operateur envoie une demande de code
 * sur le telephone du payeur, et Campay notifie le resultat sur notre webhook.
 * La transaction reste donc `processing` quelques dizaines de secondes.
 *
 * ATTENTION : les chemins et noms de champs ci-dessous doivent etre reverifies
 * sur la documentation Campay en vigueur avant la mise en production, et
 * testes d'abord sur l'environnement demo (CAMPAY_BASE_URL).
 */
class CampayGateway implements PaymentGateway
{
    public function __construct(private readonly array $config) {}

    public function name(): string
    {
        return 'campay';
    }

    public function isConfigured(): bool
    {
        return filled($this->config['username'] ?? null)
            && filled($this->config['password'] ?? null);
    }

    public function initiate(Transaction $transaction): PaymentIntent
    {
        $response = $this->client()->post('/api/collect/', [
            'amount' => (string) $transaction->amount,
            'from' => $this->msisdn($transaction->payer_phone),
            'description' => $transaction->type->label().' - '.$transaction->reference,
            'external_reference' => $transaction->reference,
        ]);

        if ($response->failed()) {
            Log::warning('Campay: echec du lancement de la collecte', [
                'transaction' => $transaction->reference,
                'status' => $response->status(),
            ]);

            return new PaymentIntent(
                status: TransactionStatus::Failed,
                failureReason: $this->errorMessage($response->json()),
                raw: $this->scrub($response->json() ?? []),
            );
        }

        $data = $response->json();

        return new PaymentIntent(
            status: TransactionStatus::Processing,
            providerReference: $data['reference'] ?? null,
            instructions: isset($data['ussd_code'])
                ? "Composez {$data['ussd_code']} sur votre téléphone pour valider le paiement."
                : 'Validez la demande de paiement reçue sur votre téléphone.',
            raw: $this->scrub($data ?? []),
        );
    }

    public function verify(Transaction $transaction): PaymentStatus
    {
        if (blank($transaction->provider_reference)) {
            return new PaymentStatus(
                status: $transaction->status,
                failureReason: 'Aucune référence passerelle enregistrée.',
            );
        }

        $response = $this->client()
            ->get("/api/transaction/{$transaction->provider_reference}/");

        if ($response->failed()) {
            return new PaymentStatus(
                status: $transaction->status,
                providerReference: $transaction->provider_reference,
                failureReason: 'Passerelle injoignable.',
                raw: $this->scrub($response->json() ?? []),
            );
        }

        return $this->toStatus($response->json() ?? []);
    }

    public function parseWebhook(Request $request): WebhookEvent
    {
        $payload = $request->all();

        return new WebhookEvent(
            signatureValid: $this->verifySignature($request),
            eventId: $payload['external_reference'] ?? $payload['reference'] ?? null,
            transactionReference: $payload['external_reference'] ?? null,
            providerReference: $payload['reference'] ?? null,
            status: $this->toStatus($payload),
            payload: $this->scrub($payload),
        );
    }

    /**
     * Campay signe ses notifications avec la cle applicative. Tant que la cle
     * n'est pas renseignee, la notification est refusee : on preferera un
     * paiement verifie a la main plutot qu'un encaissement non authentifie.
     */
    private function verifySignature(Request $request): bool
    {
        $key = $this->config['webhook_key'] ?? null;

        if (blank($key)) {
            Log::warning('Campay: CAMPAY_WEBHOOK_KEY absent, notification refusee.');

            return false;
        }

        $provided = $request->input('signature')
            ?? $request->header('X-Campay-Signature', '');

        return is_string($provided)
            && $provided !== ''
            && hash_equals($key, $provided);
    }

    private function toStatus(array $payload): PaymentStatus
    {
        $raw = strtoupper((string) ($payload['status'] ?? ''));

        $status = match ($raw) {
            'SUCCESSFUL', 'SUCCESS' => TransactionStatus::Succeeded,
            'FAILED' => TransactionStatus::Failed,
            'CANCELLED' => TransactionStatus::Cancelled,
            'PENDING' => TransactionStatus::Processing,
            default => TransactionStatus::Processing,
        };

        $operator = strtoupper((string) ($payload['operator'] ?? ''));

        return new PaymentStatus(
            status: $status,
            providerReference: $payload['reference'] ?? null,
            method: match (true) {
                str_contains($operator, 'MTN') => PaymentMethod::MtnMomo,
                str_contains($operator, 'ORANGE') => PaymentMethod::OrangeMoney,
                default => isset($payload['phone_number'])
                    ? PaymentMethod::fromCameroonPhone((string) $payload['phone_number'])
                    : null,
            },
            payerPhone: $payload['phone_number'] ?? null,
            amount: isset($payload['amount']) ? (int) $payload['amount'] : null,
            failureReason: $payload['reason'] ?? null,
            raw: $this->scrub($payload),
        );
    }

    private function client(): PendingRequest
    {
        return Http::baseUrl(rtrim($this->config['base_url'], '/'))
            ->withToken($this->token(), 'Token')
            ->acceptJson()
            ->timeout(30)
            ->retry(2, 500, throw: false);
    }

    /** Le jeton Campay est valable environ une heure : on le met en cache. */
    private function token(): string
    {
        return Cache::remember('campay.token', now()->addMinutes(50), function (): string {
            $response = Http::baseUrl(rtrim($this->config['base_url'], '/'))
                ->acceptJson()
                ->timeout(30)
                ->post('/api/token/', [
                    'username' => $this->config['username'],
                    'password' => $this->config['password'],
                ]);

            $response->throw();

            return (string) $response->json('token');
        });
    }

    /** Campay attend un numero local a 9 chiffres prefixe de l'indicatif. */
    private function msisdn(?string $phone): string
    {
        $digits = preg_replace('/\D/', '', (string) $phone) ?? '';

        return str_starts_with($digits, '237') ? $digits : '237'.$digits;
    }

    private function errorMessage(?array $body): string
    {
        return $body['message']
            ?? $body['detail']
            ?? 'Le paiement n\'a pas pu être lancé. Réessayez dans un instant.';
    }

    /** Ne jamais persister de credentials dans transactions.metadata. */
    private function scrub(array $payload): array
    {
        return collect($payload)
            ->except(['username', 'password', 'token', 'api_key', 'apikey', 'secret_key'])
            ->all();
    }
}
