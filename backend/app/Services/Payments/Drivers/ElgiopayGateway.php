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
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Elgiopay — collecte MTN Mobile Money et Orange Money.
 *
 * Parcours asynchrone : on declenche la collecte, l'operateur envoie une
 * demande de code sur le telephone du payeur, et Elgiopay notifie le resultat
 * sur notre webhook. La transaction reste `processing` entre les deux.
 *
 * L'URL de notification se configure dans le tableau de bord Elgiopay, et non
 * par requete : https://<domaine>/api/v1/webhooks/payments/elgiopay
 */
class ElgiopayGateway implements PaymentGateway
{
    /** Tolerance recommandee par Elgiopay sur l'horodatage de signature. */
    private const TOLERANCE_DEFAUT = 300;

    public function __construct(private readonly array $config) {}

    public function name(): string
    {
        return 'elgiopay';
    }

    public function isConfigured(): bool
    {
        return filled($this->config['api_key'] ?? null);
    }

    // --- Encaissement ------------------------------------------------------

    public function initiate(Transaction $transaction): PaymentIntent
    {
        $methode = $this->methodePourOperateur($transaction->payer_phone);

        if ($methode === null) {
            // Sans operateur identifie, la collecte partirait vers le mauvais
            // reseau et echouerait apres coup. Autant le dire tout de suite.
            return new PaymentIntent(
                status: TransactionStatus::Failed,
                failureReason: 'Ce numéro ne correspond ni à MTN Mobile Money ni à Orange Money.',
            );
        }

        $reponse = $this->client()->post('/api/v1/payments', [
            'amount' => $transaction->amount,
            'currency' => $transaction->currency,
            'payment_method' => $methode,
            'customer_phone' => $this->msisdn($transaction->payer_phone),
            'customer_name' => $transaction->payer_name,
            'customer_email' => $transaction->payer_email,
            'reference' => $transaction->reference,
            'description' => $transaction->type->label().' — ArtVibeCamer',
            /*
             * Notre reference est repetee dans metadata : la notification
             * renvoie le meme objet que GET /payments/{id}, qui ne garantit
             * pas de porter `reference` au premier niveau. On peut ainsi
             * retrouver la transaction sans dependre uniquement de
             * l'identifiant Elgiopay.
             */
            'metadata' => ['reference' => $transaction->reference],
        ]);

        $corps = $reponse->json() ?? [];

        if ($reponse->failed() || ($corps['success'] ?? false) !== true) {
            Log::warning('Elgiopay : échec du lancement de la collecte', [
                'transaction' => $transaction->reference,
                'statut_http' => $reponse->status(),
                'message' => $corps['message'] ?? null,
            ]);

            return new PaymentIntent(
                status: TransactionStatus::Failed,
                failureReason: $this->messageErreur($corps),
                raw: $this->nettoyer($corps),
            );
        }

        return new PaymentIntent(
            status: $this->versStatut($corps['status'] ?? 'pending'),
            providerReference: $corps['transaction_id'] ?? null,
            // Non nul pour les parcours par page hebergee (carte).
            redirectUrl: $corps['payment_url'] ?? null,
            instructions: $this->consignes($methode),
            raw: $this->nettoyer($corps),
        );
    }

    /**
     * Elgiopay interroge lui-meme l'operateur quand la transaction est encore
     * en cours, donc une simple lecture suffit a obtenir l'etat reel.
     */
    public function verify(Transaction $transaction): PaymentStatus
    {
        if (blank($transaction->provider_reference)) {
            return new PaymentStatus(
                status: $transaction->status,
                failureReason: 'Aucune référence passerelle enregistrée.',
            );
        }

        $reponse = $this->client()
            ->get("/api/v1/payments/{$transaction->provider_reference}");

        if ($reponse->failed()) {
            // 404 compris : on ne conclut pas a l'echec sur une lecture ratee,
            // ce qui invaliderait un encaissement peut-etre abouti.
            Log::warning('Elgiopay : vérification impossible', [
                'transaction' => $transaction->reference,
                'statut_http' => $reponse->status(),
            ]);

            return new PaymentStatus(
                status: $transaction->status,
                providerReference: $transaction->provider_reference,
                failureReason: 'Passerelle injoignable.',
                raw: $this->nettoyer($reponse->json() ?? []),
            );
        }

        return $this->versPaymentStatus($reponse->json() ?? []);
    }

    /**
     * Solde du compte Elgiopay.
     *
     * L'argent encaisse ne part pas directement sur un compte Mobile Money :
     * il s'accumule ici, commission deduite, jusqu'a un retrait explicite.
     * `available` est ce qui est retirable maintenant, `pending` ce qui est
     * encaisse mais pas encore libere.
     *
     * Hors interface PaymentGateway : c'est une information de tresorerie,
     * pas une etape d'encaissement.
     *
     * @return array{currency: string, available: int, pending: int, total: int}|null
     */
    public function balance(string $devise = 'XAF'): ?array
    {
        $reponse = $this->client()->get('/api/v1/balance', ['currency' => $devise]);

        if ($reponse->failed()) {
            Log::warning('Elgiopay : solde illisible', [
                'statut_http' => $reponse->status(),
            ]);

            return null;
        }

        $donnees = $reponse->json('data') ?? [];

        return [
            'currency' => $donnees['currency'] ?? $devise,
            'available' => (int) ($donnees['available_balance'] ?? 0),
            'pending' => (int) ($donnees['pending_balance'] ?? 0),
            'total' => (int) ($donnees['total_balance'] ?? 0),
        ];
    }

    // --- Notifications -----------------------------------------------------

    /**
     * Elgiopay signe chaque notification et rejoue celles qui n'obtiennent pas
     * de 2xx, jusqu'a huit fois sur environ 45 heures. La verification porte
     * donc sur trois points : signature valide, horodatage recent, et
     * identifiant d'evenement pour la deduplication en amont.
     */
    public function parseWebhook(Request $request): WebhookEvent
    {
        $charge = $request->all();
        $evenement = (string) ($charge['event'] ?? $request->header('X-Elgiopay-Event', ''));
        $donnees = (array) ($charge['data'] ?? []);

        return new WebhookEvent(
            signatureValid: $this->signatureValide($request),
            eventId: $charge['id'] ?? $request->header('X-Elgiopay-Event-Id'),
            transactionReference: $donnees['metadata']['reference'] ?? null,
            providerReference: $donnees['transaction_id'] ?? null,
            status: $this->statutPourEvenement($evenement, $donnees),
            payload: $this->nettoyer($charge),
        );
    }

    /**
     * HMAC-SHA256 de « {t}.{corps brut} ».
     *
     * Le corps doit etre lu tel qu'il est arrive : le reserialiser, ne
     * serait-ce qu'en changeant un espace, invalide la signature.
     */
    private function signatureValide(Request $request): bool
    {
        $secret = $this->config['webhook_secret'] ?? null;

        if (blank($secret)) {
            Log::warning('Elgiopay : ELGIOPAY_WEBHOOK_SECRET absent, notification refusée.');

            return false;
        }

        $entete = (string) $request->header('X-Elgiopay-Signature', '');
        $parties = [];

        foreach (explode(',', $entete) as $couple) {
            if (str_contains($couple, '=')) {
                [$cle, $valeur] = explode('=', trim($couple), 2);
                $parties[$cle] = $valeur;
            }
        }

        if (! isset($parties['t'], $parties['v1'])) {
            return false;
        }

        // Fenetre anti-rejeu : une notification capturee et renvoyee plus tard
        // ne doit pas pouvoir recrediter un paiement.
        $tolerance = (int) ($this->config['signature_tolerance'] ?? self::TOLERANCE_DEFAUT);

        if (abs(time() - (int) $parties['t']) > $tolerance) {
            Log::warning('Elgiopay : notification hors fenêtre temporelle, refusée.', [
                'ecart_secondes' => time() - (int) $parties['t'],
            ]);

            return false;
        }

        $attendu = hash_hmac(
            'sha256',
            $parties['t'].'.'.$request->getContent(),
            (string) $secret,
        );

        // Comparaison a temps constant : une comparaison naive laisserait
        // deviner la signature octet par octet.
        return hash_equals($attendu, (string) $parties['v1']);
    }

    /**
     * Seuls les evenements de paiement nous concernent. Les evenements de
     * versement, et la mise a disposition d'un code prepaye, sont acquittes
     * sans changer l'etat de la transaction.
     */
    private function statutPourEvenement(string $evenement, array $donnees): ?PaymentStatus
    {
        return match ($evenement) {
            'payment.completed', 'payment.failed' => $this->versPaymentStatus($donnees),
            default => null,
        };
    }

    // --- Correspondances ---------------------------------------------------

    private function versPaymentStatus(array $donnees): PaymentStatus
    {
        $montant = $donnees['amount']['total'] ?? null;
        $methode = $donnees['payment']['method'] ?? null;

        return new PaymentStatus(
            status: $this->versStatut((string) ($donnees['status'] ?? '')),
            providerReference: $donnees['transaction_id'] ?? null,
            method: match ($methode) {
                'mtn_mobile_money' => PaymentMethod::MtnMomo,
                'orange_money' => PaymentMethod::OrangeMoney,
                'card' => PaymentMethod::Card,
                default => null,
            },
            payerPhone: $donnees['customer']['phone'] ?? null,
            amount: $montant !== null ? (int) $montant : null,
            failureReason: $this->motifEchec($donnees),
            raw: $this->nettoyer($donnees),
        );
    }

    private function versStatut(string $statut): TransactionStatus
    {
        return match (strtolower($statut)) {
            'completed', 'success', 'successful' => TransactionStatus::Succeeded,
            'failed', 'declined' => TransactionStatus::Failed,
            'cancelled', 'canceled' => TransactionStatus::Cancelled,
            // pending, processing, et tout etat inconnu : on attend, on ne
            // conclut pas.
            default => TransactionStatus::Processing,
        };
    }

    /**
     * Les codes du bac a sable vivent dans la plage 9200, pour ne jamais etre
     * confondus avec une erreur reelle d'operateur.
     */
    private function motifEchec(array $donnees): ?string
    {
        $code = $donnees['error_code'] ?? null;

        if ($code === null || (int) $code === 0) {
            return $donnees['message'] ?? null;
        }

        return match ((int) $code) {
            9201 => 'Le paiement a été refusé sur le téléphone du payeur.',
            9202 => 'Solde insuffisant sur le compte Mobile Money.',
            9203 => 'Le paiement n\'a pas été validé à temps.',
            9204 => 'La transaction a échoué chez l\'opérateur.',
            default => $donnees['message'] ?? "Le paiement a échoué (code {$code}).",
        };
    }

    private function methodePourOperateur(?string $telephone): ?string
    {
        if ($telephone === null) {
            return null;
        }

        return match (PaymentMethod::fromCameroonPhone($telephone)) {
            PaymentMethod::MtnMomo => 'mtn_mobile_money',
            PaymentMethod::OrangeMoney => 'orange_money',
            default => null,
        };
    }

    private function consignes(string $methode): string
    {
        $operateur = $methode === 'orange_money' ? 'Orange Money' : 'MTN Mobile Money';

        return "Une demande de paiement {$operateur} vient d'être envoyée sur votre téléphone. "
            .'Saisissez votre code secret pour la valider.';
    }

    // --- Transport ---------------------------------------------------------

    private function client(): PendingRequest
    {
        return Http::baseUrl(rtrim((string) $this->config['base_url'], '/'))
            ->withToken((string) $this->config['api_key'])
            ->acceptJson()
            ->timeout(30)
            // Une coupure passagere ne doit pas faire echouer un encaissement :
            // on retente sans lever, et l'appelant decide.
            ->retry(2, 500, throw: false);
    }

    /** Elgiopay attend un numero au format international. */
    private function msisdn(?string $telephone): string
    {
        $chiffres = preg_replace('/\D/', '', (string) $telephone) ?? '';

        return str_starts_with($chiffres, '237') ? $chiffres : '237'.$chiffres;
    }

    private function messageErreur(array $corps): string
    {
        if (isset($corps['errors']) && is_array($corps['errors'])) {
            $premier = reset($corps['errors']);

            if (is_array($premier) && isset($premier[0])) {
                return (string) $premier[0];
            }
        }

        return $corps['message']
            ?? "Le paiement n'a pas pu être lancé. Réessayez dans un instant.";
    }

    /** Aucun identifiant d'API ne doit finir dans transactions.metadata. */
    private function nettoyer(array $charge): array
    {
        return collect($charge)
            ->except(['api_key', 'apikey', 'secret', 'token', 'authorization'])
            ->all();
    }
}
