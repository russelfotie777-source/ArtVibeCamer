<?php

use App\Http\Middleware\EnsureUserCan;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Plafond global de l'API. Les limiteurs nommes (checkout, login,
        // scan...) sont definis dans AppServiceProvider.
        $middleware->throttleApi();

        $middleware->alias([
            'can.do' => EnsureUserCan::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Le front est une application Next.js separee : toutes les erreurs
        // doivent sortir en JSON, jamais en page HTML Laravel.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (ModelNotFoundException|NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Ressource introuvable.'], 404);
            }

            return null;
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Authentification requise.'], 401);
            }

            return null;
        });

        /*
         * Les notifications de paiement ne doivent jamais faire remonter une
         * erreur a la passerelle : elle rejouerait indefiniment. Le detail est
         * consigne dans payment_webhooks et dans les logs.
         */
        $exceptions->dontReport([]);
    })->create();
