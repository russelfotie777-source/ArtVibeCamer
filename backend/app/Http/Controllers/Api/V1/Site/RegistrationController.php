<?php

namespace App\Http\Controllers\Api\V1\Site;

use App\Enums\TransactionType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRegistrationRequest;
use App\Http\Resources\CandidateResource;
use App\Http\Resources\TransactionResource;
use App\Models\Category;
use App\Models\Transaction;
use App\Rules\CameroonPhone;
use App\Services\Registration\RegistrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RegistrationController extends Controller
{
    public function __construct(private readonly RegistrationService $registrations) {}

    public function store(StoreRegistrationRequest $request): JsonResponse
    {
        $category = Category::findOrFail($request->integer('category_id'));

        $data = $request->candidateData();

        if ($request->hasFile('photo')) {
            $data['photo_path'] = $request->file('photo')->store('candidates', 'public');
        }

        $result = $this->registrations->register(
            $category,
            $request->type(),
            [...$data, 'payer_phone' => $request->input('payer_phone')],
            $request->members(),
            $request,
        );

        return response()->json([
            'message' => 'Inscription enregistrée. Validez le paiement des frais sur votre téléphone.',
            'candidate' => CandidateResource::make($result->subject),
            'transaction' => TransactionResource::make($result->transaction),
            'payment' => [
                'instructions' => $result->intent->instructions,
                'redirect_url' => $result->intent->redirectUrl,
            ],
        ], 201);
    }

    /**
     * Relance l'encaissement des frais apres un paiement echoue.
     *
     * La route est indexee sur la reference de la transaction, et non sur le
     * candidat : cette reference est aleatoire et n'est communiquee qu'au
     * candidat lui-meme, alors qu'un slug de candidat est devinable. Un tiers
     * ne peut donc pas declencher de demandes de paiement en serie sur des
     * dossiers qui ne sont pas les siens.
     */
    public function retry(Request $request, Transaction $transaction): JsonResponse
    {
        abort_unless($transaction->type === TransactionType::Registration, 404);

        $candidate = $transaction->payable;

        abort_if($candidate === null, 404);

        abort_if(
            $candidate->candidate_number !== null,
            422,
            'Les frais de cette inscription sont déjà encaissés.'
        );

        $request->validate([
            'payer_phone' => ['nullable', 'string', 'max:20', new CameroonPhone],
        ]);

        $result = $this->registrations->retryPayment($candidate, $request);

        return response()->json([
            'message' => 'Nouvelle demande de paiement envoyée. Validez-la sur votre téléphone.',
            'candidate' => CandidateResource::make($result->subject),
            'transaction' => TransactionResource::make($result->transaction),
            'payment' => [
                'instructions' => $result->intent->instructions,
                'redirect_url' => $result->intent->redirectUrl,
            ],
        ], 201);
    }
}
