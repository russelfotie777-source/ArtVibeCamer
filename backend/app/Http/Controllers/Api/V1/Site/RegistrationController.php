<?php

namespace App\Http\Controllers\Api\V1\Site;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRegistrationRequest;
use App\Http\Resources\CandidateResource;
use App\Http\Resources\TransactionResource;
use App\Models\Category;
use App\Services\Registration\RegistrationService;
use Illuminate\Http\JsonResponse;

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

        $result = $this->registrations->register($category, [
            ...$data,
            'payer_phone' => $request->input('payer_phone'),
        ], $request);

        return response()->json([
            'message' => 'Inscription enregistree. Validez le paiement des frais sur votre telephone.',
            'candidate' => CandidateResource::make($result->subject),
            'transaction' => TransactionResource::make($result->transaction),
            'payment' => [
                'instructions' => $result->intent->instructions,
                'redirect_url' => $result->intent->redirectUrl,
            ],
        ], 201);
    }
}
