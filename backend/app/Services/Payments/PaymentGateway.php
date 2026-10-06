<?php

namespace App\Services\Payments;

use App\Models\Transaction;
use Illuminate\Http\Request;

/**
 * Contrat que doit respecter toute passerelle de paiement.
 *
 * Le metier (inscriptions, votes, tickets) ne depend que de cette interface :
 * changer d'operateur ou en ajouter un second ne touche ni les controleurs
 * ni les services de fulfilment.
 */
interface PaymentGateway
{
    /** Identifiant stocke dans `transactions.provider`. */
    public function name(): string;

    /** Lance l'encaissement et renvoie l'etat initial. */
    public function initiate(Transaction $transaction): PaymentIntent;

    /**
     * Interroge la passerelle sur l'etat reel d'une transaction.
     * Filet de securite quand un webhook est perdu, et utilise par la
     * verification manuelle depuis le back-office.
     */
    public function verify(Transaction $transaction): PaymentStatus;

    /** Normalise une notification entrante et valide sa signature. */
    public function parseWebhook(Request $request): WebhookEvent;

    /** Les credentials necessaires sont-ils presents ? */
    public function isConfigured(): bool;
}
