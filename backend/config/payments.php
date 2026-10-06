<?php

use App\Services\Payments\Drivers\CampayGateway;
use App\Services\Payments\Drivers\CinetPayGateway;
use App\Services\Payments\Drivers\FakeGateway;

return [

    /*
    |---------------------------------------------------------------------------
    | Passerelle active
    |---------------------------------------------------------------------------
    | `fake` encaisse sans appel reseau : c'est le driver de developpement et
    | de test, il permet de derouler tout le parcours sans credentials.
    | Il est refuse en production par PaymentManager.
    */

    'driver' => env('PAYMENT_DRIVER', 'fake'),

    'currency' => env('PAYMENT_CURRENCY', 'XAF'),

    /*
    | Delai laisse au payeur pour valider sur son telephone. Passe ce delai la
    | transaction est marquee `expired` et la jauge de tickets est liberee.
    */
    'payment_timeout_minutes' => (int) env('PAYMENT_TIMEOUT_MINUTES', 15),

    /*
    | Bornes de montant, garde-fou contre une erreur de saisie ou une
    | manipulation du formulaire cote client.
    */
    'min_amount' => 100,
    'max_amount' => 5_000_000,

    'drivers' => [

        'fake' => [
            'class' => FakeGateway::class,
            // Simule un echec pour les numeros finissant par ce chiffre,
            // afin de pouvoir tester le parcours "paiement refuse".
            'failing_phone_suffix' => '0',
        ],

        'campay' => [
            'class' => CampayGateway::class,
            'base_url' => env('CAMPAY_BASE_URL', 'https://demo.campay.net'),
            'username' => env('CAMPAY_APP_USERNAME'),
            'password' => env('CAMPAY_APP_PASSWORD'),
            'webhook_key' => env('CAMPAY_WEBHOOK_KEY'),
        ],

        'cinetpay' => [
            'class' => CinetPayGateway::class,
            'base_url' => env('CINETPAY_BASE_URL', 'https://api-checkout.cinetpay.com'),
            'site_id' => env('CINETPAY_SITE_ID'),
            'api_key' => env('CINETPAY_API_KEY'),
            'secret_key' => env('CINETPAY_SECRET_KEY'),
        ],

    ],

    /*
    |---------------------------------------------------------------------------
    | Limitation du nombre de votes par achat
    |---------------------------------------------------------------------------
    */

    'votes' => [
        'min_quantity' => 1,
        'max_quantity' => (int) env('VOTE_MAX_QUANTITY', 1000),
    ],

];
