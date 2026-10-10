<?php

namespace App\Services\Registration;

use App\Enums\CandidateStatus;
use App\Enums\PaymentMethod;
use App\Enums\RegistrationType;
use App\Enums\TransactionType;
use App\Models\Candidate;
use App\Models\CandidateMember;
use App\Models\Category;
use App\Models\Transaction;
use App\Services\Payments\CheckoutResult;
use App\Services\Payments\PaymentProcessor;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Inscription d'un candidat, seul ou en groupe, et encaissement des frais.
 *
 * Le dossier est cree avant le paiement, en `awaiting_payment` : un candidat
 * dont le paiement echoue n'a pas a ressaisir son formulaire, il relance
 * simplement l'encaissement.
 */
class RegistrationService
{
    public function __construct(private readonly PaymentProcessor $payments) {}

    /**
     * @param  array<int, array{full_name: string, photo: ?UploadedFile}>  $members
     */
    public function register(
        Category $category,
        RegistrationType $type,
        array $data,
        array $members,
        Request $request,
    ): CheckoutResult {
        if (! $category->isRegistrationOpen()) {
            throw ValidationException::withMessages([
                'category_id' => $category->isFull()
                    ? 'Cette catégorie a atteint son nombre maximum de candidats.'
                    : 'Les inscriptions ne sont pas ouvertes pour cette catégorie.',
            ]);
        }

        if ($type->isGroup()) {
            $this->assertGroupAllowed($category, $members);
        }

        // Le numero a debiter accompagne la demande mais n'appartient pas au
        // dossier du candidat : on le sort avant la creation du modele.
        $payerPhone = $data['payer_phone'] ?? null;
        unset($data['payer_phone']);

        // Le montant vient de la categorie et de la formule choisie, jamais
        // du client : un prix envoye par le navigateur serait manipulable.
        $montant = $category->feeFor($type);

        [$candidate, $transaction] = DB::transaction(function () use (
            $category, $type, $data, $members, $request, $payerPhone, $montant
        ) {
            $candidate = Candidate::create([
                ...$data,
                'category_id' => $category->id,
                'registration_type' => $type,
                'members_count' => count($members),
                'status' => CandidateStatus::AwaitingPayment,
                'ip_address' => $request->ip(),
            ]);

            $this->attachMembers($candidate, $members);

            $transaction = Transaction::create([
                'reference' => Transaction::generateReference(TransactionType::Registration),
                'type' => TransactionType::Registration,
                'payable_type' => $candidate->getMorphClass(),
                'payable_id' => $candidate->id,
                'amount' => $montant,
                'currency' => config('payments.currency'),
                'payer_name' => $candidate->display_name,
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

        return new CheckoutResult(
            $candidate->refresh()->load('members'),
            $transaction->refresh(),
            $intent,
        );
    }

    /**
     * Relance l'encaissement d'une inscription restee impayee, sans recreer
     * le dossier.
     */
    public function retryPayment(Candidate $candidate, Request $request): CheckoutResult
    {
        if ($candidate->candidate_number !== null) {
            throw ValidationException::withMessages([
                'candidate' => 'Cette inscription est déjà payée.',
            ]);
        }

        $candidate->loadMissing('category');

        $transaction = Transaction::create([
            'reference' => Transaction::generateReference(TransactionType::Registration),
            'type' => TransactionType::Registration,
            'payable_type' => $candidate->getMorphClass(),
            'payable_id' => $candidate->id,
            // Le tarif est relu depuis la categorie et la formule du dossier :
            // on ne reprend pas le montant de la tentative precedente, qui
            // pourrait dater d'avant un changement de tarif.
            'amount' => $candidate->category->feeFor($candidate->registration_type),
            'currency' => config('payments.currency'),
            'payer_name' => $candidate->display_name,
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

    /** @param array<int, array{full_name: string, photo: ?UploadedFile}> $members */
    private function assertGroupAllowed(Category $category, array $members): void
    {
        if (! $category->allowsGroup()) {
            throw ValidationException::withMessages([
                'registration_type' => "La catégorie « {$category->name} » ne se présente qu'en individuel.",
            ]);
        }

        $nombre = count($members);

        if ($nombre < 2) {
            throw ValidationException::withMessages([
                'members' => 'Un groupe compte au moins deux membres.',
            ]);
        }

        if ($nombre > $category->max_group_members) {
            throw ValidationException::withMessages([
                'members' => "Un groupe de cette catégorie compte au maximum {$category->max_group_members} membres.",
            ]);
        }
    }

    /** @param array<int, array{full_name: string, photo: ?UploadedFile}> $members */
    private function attachMembers(Candidate $candidate, array $members): void
    {
        foreach ($members as $position => $membre) {
            $photo = $membre['photo'] ?? null;

            CandidateMember::create([
                'candidate_id' => $candidate->id,
                'full_name' => $membre['full_name'],
                'photo_path' => $photo instanceof UploadedFile
                    ? $photo->store('membres', 'public')
                    : null,
                'position' => $position,
            ]);
        }
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
