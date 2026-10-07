<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Le back-office donne acces aux recettes et aux donnees personnelles des
 * candidats. Ces tests verifient que chaque role reste dans son perimetre.
 */
class AccessControlTest extends TestCase
{
    use RefreshDatabase, TestSupport;

    public function test_le_back_office_est_ferme_sans_jeton(): void
    {
        $this->getJson('/api/v1/admin/dashboard')->assertStatus(401);
        $this->getJson('/api/v1/admin/candidates')->assertStatus(401);
        $this->getJson('/api/v1/admin/transactions')->assertStatus(401);
    }

    public function test_un_agent_de_scan_n_accede_pas_aux_donnees_de_l_evenement(): void
    {
        $agent = $this->makeUser(UserRole::Scanner);

        // Il peut scanner...
        $this->actingAs($agent, 'sanctum')
            ->postJson('/api/v1/admin/scan', ['code' => 'INCONNU'])
            ->assertOk();

        // ...mais rien d'autre.
        $this->actingAs($agent, 'sanctum')->getJson('/api/v1/admin/dashboard')->assertStatus(403);
        $this->actingAs($agent, 'sanctum')->getJson('/api/v1/admin/candidates')->assertStatus(403);
        $this->actingAs($agent, 'sanctum')->getJson('/api/v1/admin/exports/transactions')->assertStatus(403);
    }

    public function test_un_moderateur_valide_mais_ne_modifie_pas_les_tarifs(): void
    {
        $moderator = $this->makeUser(UserRole::Moderator);
        $category = $this->makeCategory();

        $this->actingAs($moderator, 'sanctum')
            ->getJson('/api/v1/admin/candidates')
            ->assertOk();

        // Un changement de tarif modifie ce que paieront les prochains inscrits.
        $this->actingAs($moderator, 'sanctum')
            ->patchJson("/api/v1/admin/categories/{$category->id}", ['registration_fee' => 1])
            ->assertStatus(403);

        $this->assertSame(8000, $category->fresh()->registration_fee);
    }

    public function test_un_compte_desactive_est_refuse(): void
    {
        $user = $this->makeUser(UserRole::Admin);
        $user->update(['is_active' => false]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/admin/dashboard')
            ->assertStatus(403);
    }

    public function test_les_identifiants_incorrects_sont_refuses(): void
    {
        $this->makeUser(UserRole::Admin);

        $this->postJson('/api/v1/admin/login', [
            'email' => 'admin@artvibecamer.test',
            'password' => 'mauvais-mot-de-passe',
        ])->assertStatus(422);
    }

    public function test_les_donnees_personnelles_ne_sortent_pas_vers_le_public(): void
    {
        $category = $this->makeCategory();
        $candidate = $this->makeCandidate($category, ['candidate_number' => 'AVC-MUS-001']);

        $response = $this->getJson("/api/v1/candidates/{$candidate->slug}")->assertOk();

        // Un candidat n'est identifie publiquement que par son nom de scene
        // et son numero.
        $response->assertJsonMissingPath('data.email')
            ->assertJsonMissingPath('data.phone')
            ->assertJsonMissingPath('data.last_name')
            ->assertJsonMissingPath('data.ip_address')
            ->assertJsonPath('data.display_name', 'Arno Vibe')
            ->assertJsonPath('data.candidate_number', 'AVC-MUS-001');
    }
}
