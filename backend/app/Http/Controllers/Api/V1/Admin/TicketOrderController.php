<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\TicketOrderResource;
use App\Models\TicketOrder;
use Illuminate\Http\Request;

class TicketOrderController extends Controller
{
    public function index(Request $request)
    {
        $orders = TicketOrder::query()
            ->with(['items.type', 'transaction'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('search'), fn ($q) => $q->where(fn ($w) => $w
                ->where('reference', 'like', '%'.$request->string('search').'%')
                ->orWhere('buyer_name', 'like', '%'.$request->string('search').'%')
                ->orWhere('buyer_phone', 'like', '%'.$request->string('search').'%')))
            ->orderByDesc('created_at')
            ->paginate(min($request->integer('per_page', 25), 100))
            ->withQueryString();

        return TicketOrderResource::collection($orders);
    }

    public function show(TicketOrder $order)
    {
        return TicketOrderResource::make(
            $order->load(['items.type', 'tickets.type', 'transaction'])
        );
    }
}
