<?php

return [

    /*
    |---------------------------------------------------------------------------
    | Proxies de confiance
    |---------------------------------------------------------------------------
    |
    | Adresses dont Laravel accepte l'en-tete `X-Forwarded-For`. Le front
    | Next.js rend une partie des pages cote serveur : sans cette liste,
    | Laravel verrait son adresse pour tous les visiteurs et les limites de
    | debit par IP bloqueraient l'ensemble du public des les premiers appels.
    |
    | Ne doit lister que les adresses du front, et elles seules. Faire
    | confiance a n'importe qui permettrait a un client de se declarer une
    | autre IP et de contourner les plafonds — ceux-la memes qui protegent le
    | vote d'un bourrage automatise.
    |
    | Le reglage vit ici, et non dans `bootstrap/app.php`, parce que les
    | middlewares y sont configures avant le chargement de la configuration :
    | un `env()` a cet endroit devient muet des que `config:cache` est actif,
    | le fichier .env n'etant alors plus lu du tout. Le garde-fou disparaissait
    | donc silencieusement en production, precisement la ou il sert.
    |
    */

    'proxies' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('TRUSTED_PROXIES', '')),
    ))),

];
