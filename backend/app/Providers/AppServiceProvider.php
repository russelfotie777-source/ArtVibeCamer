<?php

namespace App\Providers;

use App\Services\Payments\PaymentManager;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Instance unique : le jeton d'authentification de la passerelle est
        // mis en cache dans le driver, inutile de le reconstruire a chaque appel.
        $this->app->singleton(PaymentManager::class, fn ($app) => new PaymentManager(
            config('payments'),
            $app->environment(),
        ));
    }

    public function boot(): void
    {
        // Une relation oubliee dans un eager load devient une erreur en dev
        // plutot qu'une requete N+1 silencieuse en production.
        Model::preventLazyLoading(! $this->app->isProduction());

        // Les montants et les compteurs de votes ne tolerent pas une ecriture
        // partielle due a un attribut absent de $fillable.
        Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());

        if ($this->app->isProduction()) {
            URL::forceScheme('https');
        }

        $this->registerRateLimiters();
    }

    /**
     * Plafonds par usage.
     *
     * Le vote etant payant, la fraude se heurte d'abord au cout reel. Ces
     * limites visent autre chose : empecher qu'un script sature la base de
     * transactions abandonnees ou brute-force le back-office.
     */
    private function registerRateLimiters(): void
    {
        RateLimiter::for('api', fn (Request $r) => Limit::perMinute(90)->by($r->ip()));

        // Un candidat ne s'inscrit qu'une fois : large marge pour les erreurs
        // de saisie, assez bas pour bloquer un remplissage automatise.
        RateLimiter::for('registration', fn (Request $r) => Limit::perHour(8)->by($r->ip()));

        // Achats de votes et de billets.
        RateLimiter::for('checkout', fn (Request $r) => [
            Limit::perMinute(10)->by($r->ip()),
            Limit::perHour(60)->by($r->ip()),
        ]);

        // Le front interroge cette route en boucle pendant la validation du
        // paiement : la limite doit rester confortable.
        RateLimiter::for('payment-status', fn (Request $r) => Limit::perMinute(60)->by($r->ip()));

        RateLimiter::for('login', fn (Request $r) => [
            Limit::perMinute(10)->by($r->ip()),
            Limit::perMinute(5)->by((string) $r->input('email')),
        ]);

        // Les agents enchainent les scans a l'entree : plafond haut, par agent.
        RateLimiter::for('scan', fn (Request $r) => Limit::perMinute(240)->by(
            $r->user()?->id ?? $r->ip()
        ));

        // Les passerelles peuvent rejouer massivement : on ne bride que l'abus.
        RateLimiter::for('webhooks', fn (Request $r) => Limit::perMinute(300)->by($r->ip()));
    }
}
