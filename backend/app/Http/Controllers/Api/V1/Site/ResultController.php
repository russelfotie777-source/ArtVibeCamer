<?php

namespace App\Http\Controllers\Api\V1\Site;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\Category;
use App\Models\Setting;
use Illuminate\Http\Request;

class ResultController extends Controller
{
    /**
     * Resultats publics.
     *
     * L'organisation choisit ce qui est visible : le total des voix et le
     * classement peuvent etre masques pendant la competition pour ne pas
     * influencer les votes, sans pour autant fermer le site.
     */
    public function index(Request $request)
    {
        abort_unless(Setting::get('results_public', true), 403, 'Les resultats ne sont pas encore publies.');

        $showTally = Setting::get('show_vote_counts', true);

        $categories = Category::query()
            ->active()
            ->ordered()
            ->with(['candidates' => fn ($q) => $q->visible()->ranked()->limit(
                max(1, min($request->integer('limit', 10), 50))
            )])
            ->get();

        return response()->json([
            'data' => $categories->map(fn (Category $category) => [
                'category' => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                    'candidates_count' => $category->candidates_count,
                    'votes_count' => $showTally ? $category->votes_count : null,
                ],
                'ranking' => $category->candidates->values()->map(fn (Candidate $c, int $i) => [
                    'position' => $i + 1,
                    'candidate_number' => $c->candidate_number,
                    'name' => $c->display_name,
                    'slug' => $c->slug,
                    'photo_url' => $c->photo_url,
                    'votes_count' => $showTally ? $c->votes_count : null,
                ]),
            ]),
            'meta' => [
                'show_vote_counts' => $showTally,
                'updated_at' => now()->toIso8601String(),
            ],
        ]);
    }
}
