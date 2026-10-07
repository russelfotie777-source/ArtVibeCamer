<?php

use App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Api\V1\Site;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API ArtVibeCamer - v1
|--------------------------------------------------------------------------
| Deux espaces :
|   - public  : consulte par le site Next.js, sans authentification
|   - admin   : back-office, jeton Sanctum obligatoire
|
| Le contrat detaille de chaque route est documente dans docs/API.md.
*/

Route::prefix('v1')->group(function () {

    /*
    |----------------------------------------------------------------------
    | Espace public
    |----------------------------------------------------------------------
    */

    Route::get('settings', [Site\SettingController::class, 'index']);

    Route::get('categories', [Site\CategoryController::class, 'index']);
    Route::get('categories/{category}', [Site\CategoryController::class, 'show']);

    Route::get('candidates', [Site\CandidateController::class, 'index']);
    Route::get('candidates/{candidate}', [Site\CandidateController::class, 'show']);

    Route::get('results', [Site\ResultController::class, 'index']);

    Route::get('ticket-types', [Site\TicketController::class, 'types']);

    // La reference de commande est aleatoire et connue du seul acheteur :
    // c'est elle qui autorise l'acces aux QR codes.
    Route::get('ticket-orders/{order}', [Site\TicketController::class, 'show']);

    // Suivi d'un paiement pendant que le payeur valide sur son telephone.
    Route::get('payments/{transaction}', [Site\PaymentController::class, 'show'])
        ->middleware('throttle:payment-status');

    /*
    | Creations d'encaissement : limitees par IP. Le vote etant payant, la
    | fraude coute de l'argent, mais ce plafond evite qu'un script ne sature
    | la base de transactions abandonnees.
    */
    Route::post('registrations', [Site\RegistrationController::class, 'store'])
        ->middleware('throttle:registration');

    // Relance d'un encaissement echoue, sans ressaisie du formulaire.
    Route::post('registrations/{transaction}/retry', [Site\RegistrationController::class, 'retry'])
        ->middleware('throttle:checkout');

    Route::post('candidates/{candidate}/votes', [Site\VoteController::class, 'store'])
        ->middleware('throttle:checkout');

    Route::post('ticket-orders', [Site\TicketController::class, 'store'])
        ->middleware('throttle:checkout');

    /*
    | Notifications des passerelles. Non authentifiees par nature : la
    | legitimite est etablie par la signature ou par une re-verification
    | serveur a serveur, dans le driver concerne.
    */
    Route::post('webhooks/payments/{provider}', [Site\WebhookController::class, 'handle'])
        ->middleware('throttle:webhooks')
        ->name('webhooks.payments');

    /*
    |----------------------------------------------------------------------
    | Back-office
    |----------------------------------------------------------------------
    */

    Route::prefix('admin')->group(function () {

        /*
        | Les modeles exposes au public se resolvent par slug ou par reference
        | (URL lisibles, identifiants non devinables). Le back-office, lui,
        | travaille sur des identifiants numeriques : la cle de binding est
        | donc explicitee ici.
        */

        Route::post('login', [Admin\AuthController::class, 'login'])
            ->middleware('throttle:login');

        Route::middleware('auth:sanctum')->group(function () {

            Route::post('logout', [Admin\AuthController::class, 'logout']);
            Route::get('me', [Admin\AuthController::class, 'me']);

            /*
            | Controle d'acces : ouvert aux agents de scan, qui n'ont acces
            | a rien d'autre du back-office.
            */
            Route::middleware('can.do:canScan')->group(function () {
                Route::post('scan', [Admin\ScanController::class, 'store'])
                    ->middleware('throttle:scan');
                Route::get('scan/stats', [Admin\ScanController::class, 'stats']);
            });

            /*
            | Lecture des donnees de l'evenement.
            */
            Route::middleware('can.do:canAccessBackOffice')->group(function () {
                Route::get('dashboard', [Admin\DashboardController::class, 'index']);

                Route::get('candidates', [Admin\CandidateController::class, 'index']);
                Route::get('candidates/{candidate:id}', [Admin\CandidateController::class, 'show']);

                Route::get('categories', [Admin\CategoryController::class, 'index']);
                Route::get('ticket-types', [Admin\TicketTypeController::class, 'index']);

                Route::get('votes', [Admin\VoteController::class, 'index']);
                Route::get('votes/suspicious', [Admin\VoteController::class, 'suspicious']);

                Route::get('transactions', [Admin\TransactionController::class, 'index']);
                Route::get('transactions/{transaction}', [Admin\TransactionController::class, 'show']);

                Route::get('ticket-orders', [Admin\TicketOrderController::class, 'index']);
                Route::get('ticket-orders/{order}', [Admin\TicketOrderController::class, 'show']);

                Route::get('settings', [Admin\SettingController::class, 'index']);

                Route::prefix('exports')->group(function () {
                    Route::get('candidates', [Admin\ExportController::class, 'candidates']);
                    Route::get('votes', [Admin\ExportController::class, 'votes']);
                    Route::get('transactions', [Admin\ExportController::class, 'transactions']);
                    Route::get('tickets', [Admin\ExportController::class, 'tickets']);
                });
            });

            /*
            | Validation des dossiers d'inscription.
            */
            Route::middleware('can.do:canModerate')->group(function () {
                Route::post('candidates/{candidate:id}/approve', [Admin\CandidateController::class, 'approve']);
                Route::post('candidates/{candidate:id}/reject', [Admin\CandidateController::class, 'reject']);
            });

            /*
            | Ecritures metier : tarifs, jauges, annulation de votes.
            */
            Route::middleware('can.do:canManage')->group(function () {
                Route::patch('candidates/{candidate:id}', [Admin\CandidateController::class, 'update']);
                Route::delete('candidates/{candidate:id}', [Admin\CandidateController::class, 'destroy']);

                Route::post('categories', [Admin\CategoryController::class, 'store']);
                Route::patch('categories/{category:id}', [Admin\CategoryController::class, 'update']);
                Route::delete('categories/{category:id}', [Admin\CategoryController::class, 'destroy']);

                Route::post('ticket-types', [Admin\TicketTypeController::class, 'store']);
                Route::patch('ticket-types/{ticketType:id}', [Admin\TicketTypeController::class, 'update']);
                Route::delete('ticket-types/{ticketType:id}', [Admin\TicketTypeController::class, 'destroy']);

                Route::post('votes/{vote:id}/cancel', [Admin\VoteController::class, 'cancel']);

                Route::post('transactions/{transaction}/verify', [Admin\TransactionController::class, 'verify']);

                Route::put('settings', [Admin\SettingController::class, 'update']);
            });
        });
    });
});
