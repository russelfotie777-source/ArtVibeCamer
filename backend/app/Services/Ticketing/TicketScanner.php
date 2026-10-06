<?php

namespace App\Services\Ticketing;

use App\Enums\ScanResult;
use App\Enums\TicketStatus;
use App\Models\ScanLog;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Controle d'acces a l'entree.
 *
 * Point critique : le passage de `valid` a `used` se fait par un UPDATE
 * conditionne sur l'etat courant. Si deux agents scannent le meme billet au
 * meme instant, un seul UPDATE affecte une ligne, donc une seule entree est
 * autorisee. Un SELECT puis un UPDATE laisserait passer les deux.
 */
class TicketScanner
{
    public function scan(string $rawCode, User $agent, ?string $gate, Request $request): ScanOutcome
    {
        $code = trim($rawCode);
        $ticket = $this->find($code);

        if ($ticket === null) {
            return $this->log($code, null, ScanResult::NotFound, $agent, $gate, $request);
        }

        if ($ticket->status === TicketStatus::Cancelled) {
            return $this->log($code, $ticket, ScanResult::Cancelled, $agent, $gate, $request);
        }

        // Un billet n'est cense exister que paye, mais on verifie quand meme :
        // une commande remboursee ne doit plus donner acces.
        if (! $ticket->order?->isPaid()) {
            return $this->log($code, $ticket, ScanResult::OrderUnpaid, $agent, $gate, $request);
        }

        $accepted = Ticket::query()
            ->whereKey($ticket->id)
            ->where('status', TicketStatus::Valid->value)
            ->update([
                'status' => TicketStatus::Used->value,
                'used_at' => now(),
                'used_by' => $agent->id,
            ]) === 1;

        // Compteur de presentations, refus compris : plusieurs tentatives
        // apres un premier passage valide signalent une fraude.
        $ticket->increment('scan_count');

        return $this->log(
            $code,
            $ticket->refresh(),
            $accepted ? ScanResult::Accepted : ScanResult::AlreadyUsed,
            $agent,
            $gate,
            $request,
        );
    }

    /** Le QR porte le jeton ; le code court sert de secours a l'oral. */
    private function find(string $code): ?Ticket
    {
        return Ticket::with(['order', 'type'])
            ->where('qr_token', $code)
            ->orWhere('code', strtoupper($code))
            ->first();
    }

    private function log(
        string $code,
        ?Ticket $ticket,
        ScanResult $result,
        User $agent,
        ?string $gate,
        Request $request,
    ): ScanOutcome {
        ScanLog::create([
            'ticket_id' => $ticket?->id,
            // On ne journalise pas le jeton du QR en clair : il vaut droit
            // d'entree. Le code court suffit a tracer le billet.
            'raw_code' => $ticket?->code ?? mb_substr($code, 0, 32),
            'result' => $result,
            'scanned_by' => $agent->id,
            'gate' => $gate,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'scanned_at' => now(),
        ]);

        return new ScanOutcome($result, $ticket);
    }
}
