<?php

namespace App\Http\Controllers\Api\V1\Site;

use App\Http\Controllers\Controller;
use App\Http\Resources\CandidateResource;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    /** Liste des categories avec le nombre de candidats de chacune. */
    public function index()
    {
        return CategoryResource::collection(
            Category::query()->active()->ordered()->get()
        );
    }

    /** Detail d'une categorie et ses candidats, classes par nombre de voix. */
    public function show(Request $request, Category $category)
    {
        abort_unless($category->is_active, 404);

        $candidates = $category->candidates()
            ->visible()
            ->ranked()
            ->paginate(min($request->integer('per_page', 24), 60));

        return CategoryResource::make($category)->additional([
            'candidates' => CandidateResource::collection($candidates)->response()->getData(true),
        ]);
    }
}
