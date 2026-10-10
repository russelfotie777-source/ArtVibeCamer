<?php

use App\Console\Commands\ReconcilePayments;
use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Taches planifiees
|--------------------------------------------------------------------------
| En production, une seule entree cron suffit :
|   * * * * * cd /chemin/du/projet && php artisan schedule:run >> /dev/null 2>&1
*/

/*
 * Rattrapage des paiements : une notification de passerelle perdue laisserait
 * un client debite sans ses billets ni ses votes. Toutes les 5 minutes, on
 * redemande leur etat reel aux passerelles.
 *
 * withoutOverlapping : si une passerelle repond lentement, on ne veut pas
 * deux executions qui traitent la meme transaction en parallele.
 */
Schedule::command(ReconcilePayments::class)
    ->everyFiveMinutes()
    ->withoutOverlapping(10)
    ->runInBackground();

/*
 * Controle de coherence des compteurs de votes, en lecture seule.
 * Signale une derive sans rien corriger automatiquement : un ecart sur un
 * score merite un regard humain avant correction.
 */
Schedule::command('counters:recalculate', ['--dry-run' => true])
    ->dailyAt('03:30');

// Purge des jetons Sanctum expires.
Schedule::command('sanctum:prune-expired --hours=24')->daily();
