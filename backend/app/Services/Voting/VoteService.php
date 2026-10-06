<?php

namespace App\Services\Voting;

use App\Enums\PaymentMethod;
use App\Enums\TransactionType;
use App\Enums\VoteStatus;
use App\Models\Candidate;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\Vote;
use App\Services\Payments\CheckoutResult;
use App\Services\Payments\PaymentProcessor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Achat de votes.
 *
 * Le modele anti-fraude repose d'abord sur le fait que le vote est payant :
 * gonfler un score coute de l'argent reel. Par-dessus, trois garde-fous :
 *  - le prix et le montant sont calcules serveur, jamais recus du client ;
 *  - le lot reste `pending` tant que l'encaissement n'est pas confirme, donc
 *    un paiement abandonne ne laisse aucune voix ;
 *  - IP, user-agent et empreinte sont conserves pour permettre a
 *    l'organisation d'annuler un lot suspect a posteriori.
 */
class VoteService
{
    public function __construct(private readonly PaymentProcessor $payments) {}

    public function purchase(Candidate $candidate, array $data, Request $request): CheckoutResult
    {
        $category = $candidate->loadMissing('category')->category;

        if (! $candidate->isVotable()) {
            throw ValidationException::withMessages([
                'candidate' => 'Ce candidat ne peut pas recevoir de votes.',
            ]);
        }

        if (! $category->isVotingOpen()) {
            throw ValidationException::withMessages([
                'candidate' => 'Les votes ne sont pas ouverts pour cette categorie.',
            ]);
        }

        $quantity = (int) $data['quantity'];
        $min = (int) config('payments.votes.min_quantity');
        $max = (int) config('payments.votes.max_quantity');

        if ($quantity < $min || $quantity > $max) {
            throw ValidationException::withMessages([
                'quantity' => "Le nombre de votes doit etre compris entre {$min} et {$max}.",
            ]);
        }

        // Prix unitaire pris dans la categorie : le client ne choisit que la
        // quantite, jamais le montant.
        $unitPrice = $category->vote_price;
        $total = $unitPrice * $quantity;

        $this->assertAmountWithinBounds($total);

        [$vote, $transaction] = DB::transaction(function () use (
            $candidate, $category, $data, $request, $quantity, $unitPrice, $total
        ) {
            $vote = Vote::create([
                'reference' => Vote::generateReference(),
                'candidate_id' => $candidate->id,
                'category_id' => $category->id,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'total_amount' => $total,
                'voter_name' => $data['voter_name'] ?? null,
                'voter_phone' => $data['voter_phone'],
                'voter_email' => $data['voter_email'] ?? null,
                'status' => VoteStatus::Pending,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'fingerprint' => $this->fingerprint($request),
            ]);

            $transaction = Transaction::create([
                'reference' => Transaction::generateReference(TransactionType::Vote),
                'type' => TransactionType::Vote,
                'payable_type' => $vote->getMorphClass(),
                'payable_id' => $vote->id,
                'amount' => $total,
                'currency' => config('payments.currency'),
                'payer_name' => $data['voter_name'] ?? null,
                'payer_phone' => $data['voter_phone'],
                'payer_email' => $data['voter_email'] ?? null,
                'payment_method' => PaymentMethod::fromCameroonPhone($data['voter_phone']),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            $vote->update(['transaction_id' => $transaction->id]);

            return [$vote, $transaction];
        });

        $intent = $this->payments->start($transaction);

        return new CheckoutResult($vote->refresh(), $transaction->refresh(), $intent);
    }

    /**
     * Annulation d'un lot juge frauduleux. Retire les voix du compteur et
     * conserve la justification.
     */
    public function cancel(Vote $vote, int $userId, string $reason): Vote
    {
        return DB::transaction(function () use ($vote, $userId, $reason) {
            /** @var Vote $fresh */
            $fresh = Vote::query()->lockForUpdate()->findOrFail($vote->id);

            if ($fresh->status !== VoteStatus::Confirmed) {
                throw ValidationException::withMessages([
                    'vote' => 'Seul un lot de votes confirme peut etre annule.',
                ]);
            }

            Candidate::whereKey($fresh->candidate_id)->decrement('votes_count', $fresh->quantity);
            Category::whereKey($fresh->category_id)->decrement('votes_count', $fresh->quantity);

            $fresh->update([
                'status' => VoteStatus::Cancelled,
                'cancelled_by' => $userId,
                'cancelled_at' => now(),
                'cancellation_reason' => $reason,
            ]);

            return $fresh;
        });
    }

    /**
     * Empreinte grossiere du navigateur. Ne sert pas a bloquer un vote (le
     * paiement s'en charge) mais a reperer les lots suspects lors du
     * depouillement.
     */
    private function fingerprint(Request $request): string
    {
        return hash('sha256', implode('|', [
            $request->ip(),
            $request->userAgent() ?? '',
            $request->header('Accept-Language', ''),
        ]));
    }

    private function assertAmountWithinBounds(int $amount): void
    {
        if ($amount < (int) config('payments.min_amount')
            || $amount > (int) config('payments.max_amount')) {
            throw ValidationException::withMessages([
                'quantity' => 'Le montant total depasse les limites autorisees.',
            ]);
        }
    }
}
