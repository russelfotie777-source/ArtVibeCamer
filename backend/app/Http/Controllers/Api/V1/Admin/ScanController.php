<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ScanLog;
use App\Services\Reporting\StatsService;
use App\Services\Ticketing\TicketScanner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScanController extends Controller
{
    public function __construct(
        private readonly TicketScanner $scanner,
        private readonly StatsService $stats,
    ) {}

    /**
     * Controle d'un billet a l'entree.
     *
     * Repond toujours 200 avec `granted` : l'agent a besoin d'un verdict
     * immediat et lisible, pas d'un code d'erreur HTTP a interpreter dans le
     * bruit de l'entree.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:128'],
            'gate' => ['nullable', 'string', 'max:60'],
        ]);

        $outcome = $this->scanner->scan(
            $data['code'],
            $request->user(),
            $data['gate'] ?? null,
            $request,
        );

        return response()->json([
            'granted' => $outcome->granted(),
            'result' => $outcome->result->value,
            'message' => $outcome->result->label(),
            'ticket' => $outcome->ticket === null ? null : [
                'code' => $outcome->ticket->code,
                'holder_name' => $outcome->ticket->holder_name,
                'type' => $outcome->ticket->type?->name,
                'status' => $outcome->ticket->status->value,
                // Permet a l'agent de voir quand le billet a deja ete presente.
                'used_at' => $outcome->ticket->used_at?->toIso8601String(),
                'scan_count' => $outcome->ticket->scan_count,
            ],
        ]);
    }

    /** Suivi des entrees en temps reel. */
    public function stats(): JsonResponse
    {
        return response()->json([
            'entrance' => $this->stats->entrance(),
            'recent' => ScanLog::query()
                ->with(['ticket:id,code,ticket_type_id', 'scanner:id,name'])
                ->orderByDesc('scanned_at')
                ->limit(20)
                ->get()
                ->map(fn (ScanLog $log) => [
                    'code' => $log->raw_code,
                    'result' => $log->result->value,
                    'result_label' => $log->result->label(),
                    'gate' => $log->gate,
                    'agent' => $log->scanner?->name,
                    'scanned_at' => $log->scanned_at?->toIso8601String(),
                ]),
        ]);
    }
}
