<?php

namespace App\Services\Payments;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\PaymentWebhook;
use App\Models\Transaction;
use App\Services\Payments\Fulfilment\Fulfilment;
use App\Services\Payments\Fulfilment\RegistrationFulfilment;
use App\Services\Payments\Fulfilment\TicketFulfilment;
use App\Services\Payments\Fulfilment\VoteFulfilment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Point de passage unique de tout changement d'etat d'un encaissement.
 *
 * Trois invariants que ce service garantit :
 *
 *  1. Une transaction dans un etat final n'en sort plus. Une notification
 *     en retard ne peut pas re-crediter des votes deja credites.
 *  2. Le changement d'etat et la delivrance de la contrepartie sont dans la
 *     meme transaction SQL. Pas de billet emis sans paiement enregistre, pas
 *     de paiement enregistre sans billet emis.
 *  3. La ligne est verrouillee en lecture-ecriture le temps du traitement, ce
 *     qui serialise un webhook et une verification manuelle simultanes.
 */
class PaymentProcessor
{
    public function __construct(private readonly PaymentManager $manager) {}

    /**
     * Lance l'encaissement aupres de la passerelle.
     * Certaines passerelles repondent immediatement (carte refusee, simulation) :
     * le resultat est alors applique sans attendre de notification.
     */
    public function start(Transaction $transaction): PaymentIntent
    {
        $gateway = $this->manager->default();

        $transaction->forceFill([
            'provider' => $gateway->name(),
            'status' => TransactionStatus::Processing,
            'processing_at' => now(),
            'expires_at' => $transaction->expires_at
                ?? now()->addMinutes((int) config('payments.payment_timeout_minutes')),
        ])->save();

        try {
            $intent = $gateway->initiate($transaction);
        } catch (Throwable $e) {
            Log::error('Paiement: la passerelle a leve une exception', [
                'transaction' => $transaction->reference,
                'provider' => $gateway->name(),
                'message' => $e->getMessage(),
            ]);

            // On laisse la transaction en `processing` : elle sera tranchee par
            // la verification differee plutot que declaree echouee a tort, car
            // l'encaissement a peut-etre abouti cote operateur.
            return new PaymentIntent(
                status: TransactionStatus::Processing,
                failureReason: 'Paiement en cours de vérification.',
            );
        }

        $transaction->appendMetadata(['initiate' => $intent->raw]);

        if ($intent->providerReference !== null) {
            $transaction->provider_reference = $intent->providerReference;
        }

        $transaction->save();

        if ($intent->status->isFinal()) {
            $this->applyStatus($transaction, new PaymentStatus(
                status: $intent->status,
                providerReference: $intent->providerReference,
                failureReason: $intent->failureReason,
                raw: $intent->raw,
            ));
        }

        return $intent;
    }

    /**
     * Interroge la passerelle et applique l'etat reel.
     * Utilise par la verification manuelle du back-office et par la tache
     * planifiee qui rattrape les notifications perdues.
     */
    public function refresh(Transaction $transaction): Transaction
    {
        if ($transaction->status->isFinal()) {
            return $transaction;
        }

        $gateway = $this->manager->driver($transaction->provider);
        $status = $gateway->verify($transaction);

        return $this->applyStatus($transaction, $status);
    }

    /**
     * Applique un etat rapporte par la passerelle, puis delivre ou annule la
     * contrepartie. Idempotent et atomique.
     */
    public function applyStatus(Transaction $transaction, PaymentStatus $status): Transaction
    {
        return DB::transaction(function () use ($transaction, $status) {
            /** @var Transaction $fresh */
            $fresh = Transaction::query()
                ->lockForUpdate()
                ->with('payable')
                ->findOrFail($transaction->id);

            // Invariant 1 : un etat final ne se rejoue pas.
            if ($fresh->status->isFinal()) {
                return $fresh;
            }

            if (! $status->status->isFinal()) {
                $fresh->appendMetadata(['last_check' => $status->raw]);
                $fresh->save();

                return $fresh;
            }

            $fresh->status = $status->status;
            $fresh->provider_reference = $status->providerReference ?? $fresh->provider_reference;
            $fresh->payment_method = $status->method ?? $fresh->payment_method;
            $fresh->failure_reason = $status->failureReason;
            $fresh->appendMetadata(['final_check' => $status->raw]);

            if ($status->status === TransactionStatus::Succeeded) {
                $fresh->paid_at = now();
            } else {
                $fresh->failed_at = now();
            }

            $fresh->save();

            // Invariant 2 : la contrepartie est delivree dans la meme
            // transaction SQL que le changement d'etat.
            $fulfilment = $this->fulfilmentFor($fresh->type);

            if ($status->status === TransactionStatus::Succeeded) {
                $fulfilment->fulfil($fresh);
            } else {
                $fulfilment->revert($fresh);
            }

            return $fresh->refresh();
        });
    }

    /**
     * Traite une notification entrante.
     *
     * Le payload brut est persiste avant tout traitement metier : en cas de
     * litige sur un encaissement, c'est la seule preuve de ce que la
     * passerelle a reellement envoye.
     */
    public function handleWebhook(string $provider, Request $request): PaymentWebhook
    {
        $gateway = $this->manager->driver($provider);
        $event = $gateway->parseWebhook($request);

        $record = new PaymentWebhook([
            'provider' => $provider,
            'event_id' => $event->eventId,
            'provider_reference' => $event->providerReference,
            'signature_valid' => $event->signatureValid,
            'headers' => $this->safeHeaders($request),
            'payload' => $event->payload,
            'ip_address' => $request->ip(),
        ]);

        // Rejeu : les passerelles Mobile Money renvoient la meme notification
        // jusqu'a obtenir un 2xx. On l'acquitte sans la retraiter.
        if ($event->eventId !== null) {
            $existing = PaymentWebhook::where('event_id', $event->eventId)->first();

            if ($existing !== null) {
                $existing->increment('attempts');

                return $existing;
            }
        }

        $record->save();

        if (! $event->signatureValid) {
            Log::warning('Paiement: notification rejetee, signature invalide', [
                'provider' => $provider,
                'ip' => $request->ip(),
            ]);

            $record->markFailed('Signature invalide.');

            return $record;
        }

        /*
         * Toutes les notifications ne changent pas l'etat d'un paiement : une
         * passerelle annonce aussi ses versements, ou la mise a disposition
         * d'un code prepaye. On les acquitte pour qu'elles ne soient pas
         * rejouees, sans rien toucher au metier.
         */
        if ($event->status === null) {
            $record->markProcessed();

            return $record;
        }

        $transaction = $this->locateTransaction($event);

        if ($transaction === null) {
            $record->markFailed('Transaction introuvable.');

            return $record;
        }

        $record->transaction_id = $transaction->id;
        $record->save();

        try {
            $this->applyStatus($transaction, $event->status);
            $record->markProcessed();
        } catch (Throwable $e) {
            Log::error('Paiement: echec du traitement de la notification', [
                'provider' => $provider,
                'transaction' => $transaction->reference,
                'message' => $e->getMessage(),
            ]);

            // Laisse `processed_at` a NULL : la notification sera rejouee par
            // la passerelle ou reprise par la tache de rattrapage.
            $record->markFailed($e->getMessage());
        }

        return $record;
    }

    private function locateTransaction(WebhookEvent $event): ?Transaction
    {
        if ($event->transactionReference !== null) {
            $found = Transaction::where('reference', $event->transactionReference)->first();

            if ($found !== null) {
                return $found;
            }
        }

        return $event->providerReference !== null
            ? Transaction::where('provider_reference', $event->providerReference)->first()
            : null;
    }

    private function fulfilmentFor(TransactionType $type): Fulfilment
    {
        return match ($type) {
            TransactionType::Registration => app(RegistrationFulfilment::class),
            TransactionType::Vote => app(VoteFulfilment::class),
            TransactionType::Ticket => app(TicketFulfilment::class),
        };
    }

    /** Les en-tetes peuvent porter un jeton d'API : on ne garde que l'utile. */
    private function safeHeaders(Request $request): array
    {
        return collect($request->headers->all())
            ->only(['content-type', 'user-agent', 'x-forwarded-for', 'x-real-ip'])
            ->all();
    }
}
