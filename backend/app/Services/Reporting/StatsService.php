<?php

namespace App\Services\Reporting;

use App\Enums\CandidateStatus;
use App\Enums\TicketOrderStatus;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Enums\VoteStatus;
use App\Models\Candidate;
use App\Models\Category;
use App\Models\PaymentWebhook;
use App\Models\ScanLog;
use App\Models\Ticket;
use App\Models\TicketOrder;
use App\Models\Transaction;
use App\Models\Vote;
use Illuminate\Support\Facades\DB;

/**
 * Agregats du tableau de bord.
 *
 * Toutes les recettes se lisent dans `transactions` avec status=succeeded :
 * une seule source de verite financiere, directement reconciliable avec les
 * releves de l'operateur Mobile Money.
 */
class StatsService
{
    /** Vue d'ensemble affichee en haut du tableau de bord. */
    public function overview(): array
    {
        $revenue = $this->revenueByType();
        $commission = $this->commission();

        return [
            'candidates' => [
                'total' => Candidate::count(),
                'paid' => Candidate::whereNotNull('candidate_number')->count(),
                'awaiting_payment' => Candidate::where('status', CandidateStatus::AwaitingPayment->value)->count(),
                'pending_review' => Candidate::where('status', CandidateStatus::PendingReview->value)->count(),
                'active' => Candidate::where('status', CandidateStatus::Active->value)->count(),
                'rejected' => Candidate::where('status', CandidateStatus::Rejected->value)->count(),
            ],
            'votes' => [
                // Somme des quantites et non nombre de lignes : une ligne
                // represente un lot de plusieurs voix.
                'total' => (int) Vote::confirmed()->sum('quantity'),
                'orders' => Vote::confirmed()->count(),
                'pending_orders' => Vote::where('status', VoteStatus::Pending->value)->count(),
            ],
            'tickets' => [
                'sold' => Ticket::count(),
                'orders' => TicketOrder::paid()->count(),
                'checked_in' => Ticket::where('status', 'used')->count(),
                'pending_orders' => TicketOrder::where('status', TicketOrderStatus::Pending->value)->count(),
            ],
            /*
             * `total` est le brut : ce que les payeurs ont verse. `net` est ce
             * que l'organisation touche reellement, la passerelle prelevant sa
             * commission a l'encaissement. Afficher l'un pour l'autre fausse
             * les comptes rendus a l'organisateur et aux sponsors.
             */
            'revenue' => [
                'registrations' => $revenue[TransactionType::Registration->value] ?? 0,
                'votes' => $revenue[TransactionType::Vote->value] ?? 0,
                'tickets' => $revenue[TransactionType::Ticket->value] ?? 0,
                'total' => array_sum($revenue),
                'fees' => $commission['fees'],
                'net' => $commission['net'],
                'currency' => config('payments.currency'),
            ],
            'payments' => [
                'succeeded' => Transaction::succeeded()->count(),
                'pending' => Transaction::whereIn('status', [
                    TransactionStatus::Pending->value,
                    TransactionStatus::Processing->value,
                ])->count(),
                'failed' => Transaction::whereIn('status', [
                    TransactionStatus::Failed->value,
                    TransactionStatus::Expired->value,
                    TransactionStatus::Cancelled->value,
                ])->count(),
            ],
        ];
    }

    /** @return array<string, int> Recettes encaissees par type de flux. */
    public function revenueByType(): array
    {
        return Transaction::succeeded()
            ->select('type', DB::raw('SUM(amount) AS total'))
            ->groupBy('type')
            ->pluck('total', 'type')
            ->map(fn ($v) => (int) $v)
            ->all();
    }

    /**
     * Commission prelevee et montant net, sur les encaissements confirmes.
     *
     * `net_amount` est nul quand la passerelle ne communique pas de frais —
     * simulation, encaissement hors ligne. On retombe alors sur le brut
     * plutot que de compter zero, ce qui sous-estimerait la recette.
     *
     * @return array{fees: int, net: int}
     */
    public function commission(): array
    {
        $ligne = Transaction::succeeded()
            ->selectRaw('COALESCE(SUM(fees), 0) AS frais')
            ->selectRaw('COALESCE(SUM(COALESCE(net_amount, amount)), 0) AS net')
            ->first();

        return [
            'fees' => (int) ($ligne->frais ?? 0),
            'net' => (int) ($ligne->net ?? 0),
        ];
    }

    /** Repartition par categorie : candidats, voix et recettes de vote. */
    public function byCategory(): array
    {
        $voteRevenue = Vote::confirmed()
            ->select('category_id', DB::raw('SUM(total_amount) AS revenue'))
            ->groupBy('category_id')
            ->pluck('revenue', 'category_id');

        return Category::query()
            ->ordered()
            ->get()
            ->map(fn (Category $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                'candidates_count' => $category->candidates_count,
                'active_candidates' => $category->candidates()
                    ->where('status', CandidateStatus::Active->value)->count(),
                'votes_count' => $category->votes_count,
                'vote_revenue' => (int) ($voteRevenue[$category->id] ?? 0),
                'registration_fee' => $category->registration_fee,
                'vote_price' => $category->vote_price,
            ])
            ->all();
    }

    /**
     * Courbe d'evolution sur les N derniers jours.
     * Les jours sans activite sont renvoyes a zero pour que le graphique du
     * front n'ait pas a combler les trous.
     */
    public function timeline(int $days = 14): array
    {
        $since = now()->subDays($days - 1)->startOfDay();

        $votes = Vote::confirmed()
            ->where('confirmed_at', '>=', $since)
            ->select(DB::raw('DATE(confirmed_at) AS day'), DB::raw('SUM(quantity) AS total'))
            ->groupBy('day')
            ->pluck('total', 'day');

        $revenue = Transaction::succeeded()
            ->where('paid_at', '>=', $since)
            ->select(DB::raw('DATE(paid_at) AS day'), DB::raw('SUM(amount) AS total'))
            ->groupBy('day')
            ->pluck('total', 'day');

        $registrations = Candidate::whereNotNull('candidate_number')
            ->where('updated_at', '>=', $since)
            ->select(DB::raw('DATE(updated_at) AS day'), DB::raw('COUNT(*) AS total'))
            ->groupBy('day')
            ->pluck('total', 'day');

        $tickets = Ticket::where('created_at', '>=', $since)
            ->select(DB::raw('DATE(created_at) AS day'), DB::raw('COUNT(*) AS total'))
            ->groupBy('day')
            ->pluck('total', 'day');

        $series = [];

        for ($i = 0; $i < $days; $i++) {
            $day = $since->copy()->addDays($i)->toDateString();

            $series[] = [
                'date' => $day,
                'votes' => (int) ($votes[$day] ?? 0),
                'revenue' => (int) ($revenue[$day] ?? 0),
                'registrations' => (int) ($registrations[$day] ?? 0),
                'tickets' => (int) ($tickets[$day] ?? 0),
            ];
        }

        return $series;
    }

    /** Classement general, toutes categories confondues. */
    public function leaderboard(int $limit = 10): array
    {
        return Candidate::query()
            ->visible()
            ->with('category:id,name,slug')
            ->ranked()
            ->limit($limit)
            ->get()
            ->map(fn (Candidate $c, int $i) => [
                'position' => $i + 1,
                'id' => $c->id,
                'candidate_number' => $c->candidate_number,
                'name' => $c->display_name,
                'slug' => $c->slug,
                'photo_url' => $c->photo_url,
                'category' => $c->category->name,
                'votes_count' => $c->votes_count,
            ])
            ->all();
    }

    /** Suivi des entrees le soir de l'evenement. */
    public function entrance(): array
    {
        $issued = Ticket::count();
        $used = Ticket::where('status', 'used')->count();

        return [
            'tickets_issued' => $issued,
            'checked_in' => $used,
            'remaining' => max(0, $issued - $used),
            'rate' => $issued > 0 ? round($used / $issued * 100, 1) : 0.0,
            'rejected_scans' => ScanLog::rejected()->count(),
            'last_hour' => ScanLog::accepted()
                ->where('scanned_at', '>=', now()->subHour())
                ->count(),
        ];
    }

    /** Transactions a surveiller : paiements bloques et notifications en echec. */
    public function alerts(): array
    {
        return [
            'stale_transactions' => Transaction::stale()->count(),
            'unprocessed_webhooks' => PaymentWebhook::unprocessed()->count(),
            'invalid_signatures' => PaymentWebhook::where('signature_valid', false)->count(),
            'expired_orders' => TicketOrder::stale()->count(),
        ];
    }
}
