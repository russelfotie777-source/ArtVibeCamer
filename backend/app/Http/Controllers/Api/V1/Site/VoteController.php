<?php

namespace App\Http\Controllers\Api\V1\Site;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreVoteRequest;
use App\Http\Resources\TransactionResource;
use App\Http\Resources\VoteResource;
use App\Models\Candidate;
use App\Services\Voting\VoteService;
use Illuminate\Http\JsonResponse;

class VoteController extends Controller
{
    public function __construct(private readonly VoteService $votes) {}

    /**
     * Achat de votes pour un candidat.
     * Les voix ne sont creditees qu'a la confirmation du paiement.
     */
    public function store(StoreVoteRequest $request, Candidate $candidate): JsonResponse
    {
        $result = $this->votes->purchase($candidate, $request->validated(), $request);

        return response()->json([
            'message' => 'Votes réservés. Validez le paiement sur votre téléphone pour qu\'ils soient comptabilisés.',
            'vote' => VoteResource::make($result->subject),
            'transaction' => TransactionResource::make($result->transaction),
            'payment' => [
                'instructions' => $result->intent->instructions,
                'redirect_url' => $result->intent->redirectUrl,
            ],
        ], 201);
    }
}
