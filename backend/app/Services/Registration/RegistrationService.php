<?php

namespace App\Services\Registration;

use App\Enums\CandidateStatus;
use App\Enums\PaymentMethod;
use App\Enums\TransactionType;
use App\Models\Candidate;
use App\Models\Category;
use App\Models\Transaction;
use App\Services\Payments\CheckoutResult;
use App\Services\Payments\PaymentProcessor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Inscription d'un candidat et encaissement des frais.
 *
 * Le dossier est cree avant le paiement, en `awaiting_payment` : un candidat
 * dont le paiement echoue n'a pas a ressaisir son formulaire, il relance
 * simplement l'encaissement.
 */
class RegistrationService
{
    public function __construct(private readonly PaymentProcessor $payments) {}

    public function register(Category $category, array $data, Request $request): CheckoutResult
    {
        if (! $category->isRegistrationOpen()) {
            throw ValidationException::withMessages([
                'category' => $category->isFull()
                    ? 'Cette categorie a atteint son nombre maximum de candidats.'
                    : 'Les inscriptions ne sont pas ouvertes pour cette categorie.',
            ]);
        }

        // Le numero a debiter accompagne la demande mais n'appartient pas au
        // dossier du candidat : on le sort avant la creation du modele.
        $payerPhone = $data['payer_phone'] ?? null;
        unset($data['payer_phone']);

        [$candidate, $transaction] = DB::transaction(function () use ($category, $data, $request, $payerPhone) {
            $candidate = Candidate::create([
                ...$data,
                'category_id' => $category->id,
                'status' => CandidateStatus::AwaitingPayment,
                'ip_address' => $request->ip(),
            ]);

            // Le montant vient de la categorie, jamais du client : un prix
            // envoye par le navigateur serait manipulable.
            $transaction = Transaction::create([
                'reference' => Transaction::generateReference(TransactionType::Registration),
                'type' => TransactionType::Registration,
                'payable_type' => $candidate->getMorphClass(),
                'payable_id' => $candidate->id,
                'amount' => $category->registration_fee,
                'currency' => config('payments.currency'),
                'payer_name' => $candidate->full_name,
                'payer_phone' => $payerPhone ?? $candidate->phone,
                'payer_email' => $candidate->email,
                'payment_method' => PaymentMethod::fromCameroonPhone(
                    $payerPhone ?? $candidate->phone
                ),
                'idempotency_key' => $this->idempotencyKey($request, $candidate),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            return [$candidate, $transaction];
        });

        $intent = $this->payments->start($transaction);

        return new CheckoutResult($candidate->refresh(), $transaction->refresh(), $intent);
    }

    /**
     * Relance l'encaissement d'une inscription restee impayee, sans recreer
     * le dossier.
     */
    public function retryPayment(Candidate $candidate, Request $request): CheckoutResult
    {
        if ($candidate->candidate_number !== null) {
            throw ValidationException::withMessages([
                'candidate' => 'Cette inscription est deja payee.',
            ]);
        }

        $candidate->loadMissing('category');

        $transaction = Transaction::create([
            'reference' => Transaction::generateReference(TransactionType::Registration),
            'type' => TransactionType::Registration,
            'payable_type' => $candidate->getMorphClass(),
            'payable_id' => $candidate->id,
            'amount' => $candidate->category->registration_fee,
            'currency' => config('payments.currency'),
            'payer_name' => $candidate->full_name,
            'payer_phone' => $request->input('payer_phone', $candidate->phone),
            'payer_email' => $candidate->email,
            'payment_method' => PaymentMethod::fromCameroonPhone(
                $request->input('payer_phone', $candidate->phone)
            ),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $intent = $this->payments->start($transaction);

        return new CheckoutResult($candidate->refresh(), $transaction->refresh(), $intent);
    }

    /**
     * Empeche le double encaissement si le formulaire est re-soumis : meme
     * candidat, meme categorie, meme journee donnent la meme cle.
     */
    private function idempotencyKey(Request $request, Candidate $candidate): string
    {
        return $request->header('Idempotency-Key')
            ?: hash('sha256', implode('|', [
                'registration',
                $candidate->id,
                $candidate->category_id,
                now()->toDateString(),
            ]));
    }
}
