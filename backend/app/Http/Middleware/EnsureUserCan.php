<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Verifie une capacite portee par le role de l'utilisateur.
 * Usage dans les routes : ->middleware('can.do:canManage')
 */
class EnsureUserCan
{
    public function handle(Request $request, Closure $next, string $capability): Response
    {
        $user = $request->user();

        abort_if($user === null, 401, 'Authentification requise.');
        abort_unless($user->is_active, 403, 'Ce compte est desactive.');
        abort_unless($user->hasCapability($capability), 403, 'Vous n\'avez pas les droits necessaires.');

        return $next($request);
    }
}
