<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\Ticket;
use App\Models\Transaction;
use App\Models\Vote;
use App\Support\Audit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Exports CSV pour l'equipe (Excel, LibreOffice).
 *
 * Les lignes sont streamees par lots : le fichier n'est jamais entierement
 * charge en memoire, ce qui tient meme avec plusieurs dizaines de milliers
 * de votes.
 */
class ExportController extends Controller
{
    public function candidates(Request $request): StreamedResponse
    {
        Audit::log('export.candidates', null, 'Export CSV des candidats');

        $query = Candidate::query()
            ->with('category:id,name')
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', $request->integer('category_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderBy('category_id')
            ->orderBy('candidate_number');

        return $this->stream('candidats', [
            'Numero', 'Nom de scene', 'Nom', 'Prenom', 'Categorie', 'Statut',
            'Telephone', 'Email', 'Ville', 'Votes', 'Inscription payee', 'Inscrit le',
        ], $query, fn (Candidate $c) => [
            $c->candidate_number,
            $c->stage_name,
            $c->last_name,
            $c->first_name,
            $c->category->name,
            $c->status->label(),
            $c->phone,
            $c->email,
            $c->city,
            $c->votes_count,
            $c->candidate_number !== null ? 'Oui' : 'Non',
            $c->created_at?->format('d/m/Y H:i'),
        ]);
    }

    public function votes(Request $request): StreamedResponse
    {
        Audit::log('export.votes', null, 'Export CSV des votes');

        $query = Vote::query()
            ->with(['candidate:id,candidate_number,stage_name,first_name,last_name', 'category:id,name'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('created_at');

        return $this->stream('votes', [
            'Reference', 'Candidat', 'Numero candidat', 'Categorie', 'Quantite',
            'Montant', 'Statut', 'Telephone votant', 'IP', 'Confirme le',
        ], $query, fn (Vote $v) => [
            $v->reference,
            $v->candidate?->display_name,
            $v->candidate?->candidate_number,
            $v->category?->name,
            $v->quantity,
            $v->total_amount,
            $v->status->label(),
            $v->voter_phone,
            $v->ip_address,
            $v->confirmed_at?->format('d/m/Y H:i'),
        ]);
    }

    public function transactions(Request $request): StreamedResponse
    {
        Audit::log('export.transactions', null, 'Export CSV des transactions');

        $query = Transaction::query()
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('created_at');

        return $this->stream('transactions', [
            'Reference', 'Type', 'Montant', 'Devise', 'Statut', 'Moyen',
            'Passerelle', 'Reference passerelle', 'Payeur', 'Telephone', 'Paye le',
        ], $query, fn (Transaction $t) => [
            $t->reference,
            $t->type->label(),
            $t->amount,
            $t->currency,
            $t->status->label(),
            $t->payment_method?->label(),
            $t->provider,
            $t->provider_reference,
            $t->payer_name,
            $t->payer_phone,
            $t->paid_at?->format('d/m/Y H:i'),
        ]);
    }

    public function tickets(Request $request): StreamedResponse
    {
        Audit::log('export.tickets', null, 'Export CSV des billets');

        $query = Ticket::query()
            ->with(['type:id,name', 'order:id,reference,buyer_name,buyer_phone'])
            ->orderByDesc('created_at');

        return $this->stream('billets', [
            'Code', 'Categorie', 'Porteur', 'Commande', 'Acheteur', 'Telephone',
            'Statut', 'Utilise le', 'Nombre de scans',
        ], $query, fn (Ticket $t) => [
            $t->code,
            $t->type?->name,
            $t->holder_name,
            $t->order?->reference,
            $t->order?->buyer_name,
            $t->order?->buyer_phone,
            $t->status->label(),
            $t->used_at?->format('d/m/Y H:i'),
            $t->scan_count,
        ]);
    }

    /**
     * @param  array<int, string>  $headers
     * @param  callable(mixed): array<int, mixed>  $row
     */
    private function stream(string $name, array $headers, Builder $query, callable $row): StreamedResponse
    {
        $filename = sprintf('artvibecamer-%s-%s.csv', $name, now()->format('Ymd-Hi'));

        return response()->streamDownload(function () use ($headers, $query, $row) {
            $out = fopen('php://output', 'wb');

            // BOM UTF-8 : sans lui Excel sous Windows casse les accents.
            fwrite($out, "\xEF\xBB\xBF");

            // Separateur point-virgule : attendu par Excel en locale francaise.
            fputcsv($out, $headers, ';');

            $query->chunk(500, function ($chunk) use ($out, $row) {
                foreach ($chunk as $model) {
                    fputcsv($out, $row($model), ';');
                }
            });

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
