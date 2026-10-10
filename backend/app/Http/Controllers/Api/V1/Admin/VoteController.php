<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\VoteResource;
use App\Models\Vote;
use App\Services\Voting\VoteService;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VoteController extends Controller
{
    public function __construct(private readonly VoteService $votes) {}

    public function index(Request $request)
    {
        $votes = Vote::query()
            ->with(['candidate:id,candidate_number,stage_name,first_name,last_name,slug,category_id', 'transaction'])
            ->when($request->filled('candidate_id'), fn ($q) => $q->where('candidate_id', $request->integer('candidate_id')))
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', $request->integer('category_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('phone'), fn ($q) => $q->where('voter_phone', 'like', '%'.$request->string('phone').'%'))
            ->when($request->filled('ip'), fn ($q) => $q->where('ip_address', $request->string('ip')))
            ->orderByDesc('created_at')
            ->paginate(min($request->integer('per_page', 25), 100))
            ->withQueryString();

        return VoteResource::collection($votes);
    }

    /**
     * Lots suspects : meme empreinte ou meme IP utilisee pour un volume
     * anormal de votes. Aide au depouillement, ne bloque rien
     * automatiquement : seule l'organisation decide d'annuler.
     */
    public function suspicious(Request $request): JsonResponse
    {
        $threshold = max(2, $request->integer('threshold', 10));

        $byIp = Vote::query()
            ->confirmed()
            ->selectRaw('ip_address, COUNT(*) AS orders, SUM(quantity) AS votes')
            ->whereNotNull('ip_address')
            ->groupBy('ip_address')
            ->havingRaw('COUNT(*) >= ?', [$threshold])
            ->orderByDesc('votes')
            ->limit(50)
            ->get();

        $byFingerprint = Vote::query()
            ->confirmed()
            ->selectRaw('fingerprint, COUNT(*) AS orders, SUM(quantity) AS votes')
            ->whereNotNull('fingerprint')
            ->groupBy('fingerprint')
            ->havingRaw('COUNT(*) >= ?', [$threshold])
            ->orderByDesc('votes')
            ->limit(50)
            ->get();

        return response()->json([
            'threshold' => $threshold,
            'by_ip' => $byIp,
            'by_fingerprint' => $byFingerprint,
        ]);
    }

    /** Annulation d'un lot frauduleux : les voix sont retirees du compteur. */
    public function cancel(Request $request, Vote $vote): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $cancelled = $this->votes->cancel($vote, $request->user()->id, $data['reason']);

        Audit::log('votes.cancelled', $cancelled, "{$cancelled->quantity} vote(s) annule(s)", [
            'reason' => $data['reason'],
            'candidate_id' => $cancelled->candidate_id,
            'quantity' => $cancelled->quantity,
        ]);

        return response()->json([
            'message' => "{$cancelled->quantity} vote(s) annulé(s) et retiré(s) du compteur.",
            'vote' => VoteResource::make($cancelled->load('candidate')),
        ]);
    }
}
