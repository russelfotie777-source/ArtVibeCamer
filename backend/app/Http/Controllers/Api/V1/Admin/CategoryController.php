<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index()
    {
        return CategoryResource::collection(Category::query()->ordered()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        $category = Category::create($data);

        Audit::log('category.created', $category, "Categorie « {$category->name} » creee", $data);

        return response()->json([
            'message' => 'Catégorie créée.',
            'category' => CategoryResource::make($category),
        ], 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $data = $this->validateData($request, $category);
        $before = $category->only(array_keys($data));

        $category->update($data);

        // Un changement de tarif est tracé : il modifie ce que paieront les
        // prochains inscrits et votants.
        Audit::log('category.updated', $category, "Categorie « {$category->name} » modifiee", [
            'before' => $before,
            'after' => $data,
        ]);

        return response()->json([
            'message' => 'Catégorie mise à jour.',
            'category' => CategoryResource::make($category->fresh()),
        ]);
    }

    public function destroy(Category $category): JsonResponse
    {
        abort_if(
            $category->candidates()->exists(),
            422,
            'Cette catégorie contient des candidats. Désactivez-la plutôt que de la supprimer.'
        );

        $category->delete();
        Audit::log('category.deleted', $category, "Categorie « {$category->name} » supprimee");

        return response()->json(['message' => 'Catégorie supprimée.']);
    }

    private function validateData(Request $request, ?Category $category = null): array
    {
        return $request->validate([
            'name' => [$category ? 'sometimes' : 'required', 'string', 'max:120'],
            'slug' => [
                'nullable', 'string', 'max:140', 'alpha_dash',
                Rule::unique('categories', 'slug')->ignore($category?->id),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
            'cover_image' => ['nullable', 'string', 'max:255'],

            // Montants entiers en FCFA : jamais de decimale sur du XAF.
            'registration_fee' => [$category ? 'sometimes' : 'required', 'integer', 'min:0', 'max:1000000'],
            'vote_price' => [$category ? 'sometimes' : 'required', 'integer', 'min:1', 'max:100000'],

            'max_candidates' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'registration_opens_at' => ['nullable', 'date'],
            'registration_closes_at' => ['nullable', 'date', 'after:registration_opens_at'],
            'voting_opens_at' => ['nullable', 'date'],
            'voting_closes_at' => ['nullable', 'date', 'after:voting_opens_at'],
            'is_active' => ['sometimes', 'boolean'],
            'display_order' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ]);
    }
}
