<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\TicketTypeResource;
use App\Models\TicketType;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TicketTypeController extends Controller
{
    public function index()
    {
        return TicketTypeResource::collection(TicketType::query()->ordered()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $type = TicketType::create($this->validateData($request));

        Audit::log('ticket_type.created', $type, "Categorie de billet « {$type->name} » creee");

        return response()->json([
            'message' => 'Catégorie de billet créée.',
            'ticket_type' => TicketTypeResource::make($type),
        ], 201);
    }

    public function update(Request $request, TicketType $ticketType): JsonResponse
    {
        $data = $this->validateData($request, $ticketType);

        // La jauge ne peut pas descendre sous ce qui est deja vendu ou reserve,
        // sinon des billets payes deviendraient surnumeraires.
        if (isset($data['quantity_total']) && $data['quantity_total'] !== null) {
            $engaged = $ticketType->quantity_sold + $ticketType->quantity_reserved;

            abort_if(
                $data['quantity_total'] < $engaged,
                422,
                "Impossible : {$engaged} billet(s) sont déjà vendus ou en cours de paiement."
            );
        }

        $before = $ticketType->only(array_keys($data));
        $ticketType->update($data);

        Audit::log('ticket_type.updated', $ticketType, "Categorie « {$ticketType->name} » modifiee", [
            'before' => $before,
            'after' => $data,
        ]);

        return response()->json([
            'message' => 'Catégorie de billet mise à jour.',
            'ticket_type' => TicketTypeResource::make($ticketType->fresh()),
        ]);
    }

    public function destroy(TicketType $ticketType): JsonResponse
    {
        abort_if(
            $ticketType->tickets()->exists(),
            422,
            'Des billets de cette catégorie ont déjà été émis. Désactivez-la plutôt que de la supprimer.'
        );

        $ticketType->delete();
        Audit::log('ticket_type.deleted', $ticketType, "Categorie « {$ticketType->name} » supprimee");

        return response()->json(['message' => 'Catégorie de billet supprimée.']);
    }

    private function validateData(Request $request, ?TicketType $type = null): array
    {
        return $request->validate([
            'name' => [$type ? 'sometimes' : 'required', 'string', 'max:120'],
            'slug' => [
                'nullable', 'string', 'max:140', 'alpha_dash',
                Rule::unique('ticket_types', 'slug')->ignore($type?->id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'price' => [$type ? 'sometimes' : 'required', 'integer', 'min:0', 'max:5000000'],
            'quantity_total' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'max_per_order' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'sales_opens_at' => ['nullable', 'date'],
            'sales_closes_at' => ['nullable', 'date', 'after:sales_opens_at'],
            'is_active' => ['sometimes', 'boolean'],
            'display_order' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ]);
    }
}
