<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\TransactionResource;
use App\Models\Transaction;
use App\Services\Payments\PaymentProcessor;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransactionController extends Controller
{
    public function __construct(private readonly PaymentProcessor $payments) {}

    public function index(Request $request)
    {
        $transactions = Transaction::query()
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('search'), fn ($q) => $q->where(fn ($w) => $w
                ->where('reference', 'like', '%'.$request->string('search').'%')
                ->orWhere('provider_reference', 'like', '%'.$request->string('search').'%')
                ->orWhere('payer_phone', 'like', '%'.$request->string('search').'%')))
            ->when($request->filled('from'), fn ($q) => $q->where('created_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($q) => $q->where('created_at', '<=', $request->date('to')))
            ->orderByDesc('created_at')
            ->paginate(min($request->integer('per_page', 25), 100))
            ->withQueryString();

        return TransactionResource::collection($transactions);
    }

    public function show(Transaction $transaction)
    {
        return TransactionResource::make($transaction->load('payable'));
    }

    /**
     * Verification manuelle aupres de la passerelle.
     *
     * Indispensable quand un client affirme avoir ete debite sans que la
     * notification soit arrivee : plutot que de valider a la main, on
     * redemande son etat a l'operateur, qui fait foi.
     */
    public function verify(Transaction $transaction): JsonResponse
    {
        $before = $transaction->status;
        $fresh = $this->payments->refresh($transaction);

        Audit::log('transaction.verified', $fresh, "Verification de {$fresh->reference}", [
            'from' => $before->value,
            'to' => $fresh->status->value,
        ]);

        return response()->json([
            'message' => $before === $fresh->status
                ? 'Aucun changement : '.$fresh->status->label().'.'
                : 'Statut mis a jour : '.$fresh->status->label().'.',
            'transaction' => TransactionResource::make($fresh),
        ]);
    }
}
