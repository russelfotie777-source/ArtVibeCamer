<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $key = 'login:'.Str::lower($request->input('email')).'|'.$request->ip();

        // Verrouillage apres 5 tentatives : un back-office qui donne acces aux
        // recettes et aux donnees personnelles ne doit pas etre brute-forcable.
        if (RateLimiter::tooManyAttempts($key, 5)) {
            throw ValidationException::withMessages([
                'email' => 'Trop de tentatives. Réessayez dans '
                    .RateLimiter::availableIn($key).' secondes.',
            ]);
        }

        $user = User::where('email', $request->input('email'))->first();

        if ($user === null || ! Hash::check($request->input('password'), $user->password)) {
            RateLimiter::hit($key, 300);

            // Message unique : ne pas indiquer si l'adresse existe en base.
            throw ValidationException::withMessages([
                'email' => 'Identifiants incorrects.',
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => 'Ce compte est désactivé.',
            ]);
        }

        RateLimiter::clear($key);

        // Un jeton par appareil : revoquer un telephone perdu le soir de
        // l'evenement ne deconnecte pas toute l'equipe.
        $device = $request->input('device_name', 'back-office');
        $user->tokens()->where('name', $device)->delete();

        $token = $user->createToken($device, [$user->role->value])->plainTextToken;

        $user->recordLogin($request->ip());
        Audit::log('auth.login', $user, "Connexion depuis {$request->ip()}");

        return response()->json([
            'token' => $token,
            'user' => $this->profile($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnecté.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->profile($request->user())]);
    }

    private function profile(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'role_label' => $user->role->label(),
            'capabilities' => [
                'manage' => $user->canManage(),
                'moderate' => $user->canModerate(),
                'scan' => $user->canScan(),
                'back_office' => $user->canAccessBackOffice(),
                'administrate' => $user->role->canAdministrate(),
            ],
            'last_login_at' => $user->last_login_at?->toIso8601String(),
        ];
    }
}
