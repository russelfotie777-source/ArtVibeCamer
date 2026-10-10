<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Reporting\StatsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(private readonly StatsService $stats) {}

    /** Tout ce qu'affiche l'accueil du back-office, en une requete. */
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'overview' => $this->stats->overview(),
            'by_category' => $this->stats->byCategory(),
            'timeline' => $this->stats->timeline(min($request->integer('days', 14), 90)),
            'leaderboard' => $this->stats->leaderboard(),
            'entrance' => $this->stats->entrance(),
            'alerts' => $this->stats->alerts(),
            'generated_at' => now()->toIso8601String(),
        ]);
    }
}
