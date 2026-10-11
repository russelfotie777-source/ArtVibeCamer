<!DOCTYPE html>
{{--
  Recu de paiement, rendu en PDF par dompdf.

  Volontairement sobre et sans image : un recu se lit, s'imprime en noir et
  blanc et s'archive. Les polices sont celles embarquees par dompdf, les
  couleurs se limitent a deux teintes de la marque, et la mise en page tient
  sur une page quelle que soit la longueur des libelles.
--}}
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Reçu {{ $transaction->reference }}</title>
    <style>
        @page { margin: 28mm 20mm; }

        body {
            margin: 0;
            color: #16211b;
            font-family: DejaVu Sans, sans-serif;
            font-size: 10.5pt;
            line-height: 1.5;
        }

        .entete { border-bottom: 2px solid #0f2d1c; padding-bottom: 14px; }
        .marque { color: #0f2d1c; font-size: 19pt; font-weight: bold; letter-spacing: -0.3pt; }
        .surtitre { color: #4f5b68; font-size: 8.5pt; letter-spacing: 1.6pt; text-transform: uppercase; }
        .evenement { color: #4f5b68; font-size: 9.5pt; margin-top: 3px; }

        .titre { font-size: 15pt; font-weight: bold; margin: 26px 0 2px; }
        .reference { color: #4f5b68; font-size: 10pt; }

        .acquitte {
            display: inline-block;
            margin-top: 12px;
            padding: 5px 12px;
            border: 1.2pt solid #0f2d1c;
            color: #0f2d1c;
            font-size: 9pt;
            font-weight: bold;
            letter-spacing: 1pt;
            text-transform: uppercase;
        }

        table { width: 100%; border-collapse: collapse; }
        .lignes { margin-top: 24px; }
        .lignes th {
            border-bottom: 1pt solid #c8d2cc;
            padding: 0 0 7px;
            color: #4f5b68;
            font-size: 8.5pt;
            font-weight: normal;
            letter-spacing: 1pt;
            text-align: left;
            text-transform: uppercase;
        }
        .lignes td { border-bottom: 0.6pt solid #e4e9e5; padding: 10px 0; vertical-align: top; }
        .lignes td.valeur { text-align: right; font-weight: bold; }
        .lignes td.intitule { color: #4f5b68; width: 42%; }

        .total td { border-bottom: none; border-top: 1.4pt solid #0f2d1c; padding-top: 12px; font-size: 13pt; }

        .mention {
            margin-top: 28px;
            padding: 12px 14px;
            background: #f2f5f3;
            color: #4f5b68;
            font-size: 9pt;
        }

        .pied {
            margin-top: 34px;
            border-top: 0.6pt solid #c8d2cc;
            padding-top: 12px;
            color: #4f5b68;
            font-size: 8.5pt;
        }
        .pied td { vertical-align: top; width: 50%; }
    </style>
</head>
<body>

<div class="entete">
    <table>
        <tr>
            <td>
                <div class="surtitre">Reçu de paiement</div>
                <div class="marque">{{ $evenement }}</div>
                @if ($sousTitre)
                    <div class="evenement">{{ $sousTitre }}</div>
                @endif
            </td>
            <td style="text-align: right; color: #4f5b68; font-size: 9.5pt;">
                Émis le {{ $emisLe }}
            </td>
        </tr>
    </table>
</div>

<div class="titre">{{ $transaction->type->label() }}</div>
<div class="reference">Référence {{ $transaction->reference }}</div>
<div class="acquitte">Payé</div>

<table class="lignes">
    <tr>
        <th>Désignation</th>
        <th style="text-align: right;">Montant</th>
    </tr>

    <tr>
        <td>
            <strong>{{ $designation }}</strong>
            @if ($precision)
                <div style="color: #4f5b68; font-size: 9.5pt;">{{ $precision }}</div>
            @endif
        </td>
        <td class="valeur">{{ $montant }}</td>
    </tr>

    <tr>
        <td class="intitule">Payé par</td>
        <td class="valeur">{{ $payeur }}</td>
    </tr>

    <tr>
        <td class="intitule">Moyen de paiement</td>
        <td class="valeur">{{ $transaction->payment_method?->label() ?? 'Mobile Money' }}</td>
    </tr>

    <tr>
        <td class="intitule">Date du paiement</td>
        <td class="valeur">{{ $payeLe }}</td>
    </tr>

    @if ($transaction->provider_reference)
        <tr>
            <td class="intitule">Référence opérateur</td>
            <td class="valeur" style="font-size: 9.5pt;">{{ $transaction->provider_reference }}</td>
        </tr>
    @endif

    <tr class="total">
        <td><strong>Total réglé</strong></td>
        <td class="valeur">{{ $montant }}</td>
    </tr>
</table>

<div class="mention">
    Ce reçu atteste d&rsquo;un paiement encaissé par Mobile Money. Il ne vaut pas
    facture au sens fiscal et ne mentionne aucune taxe.
    Conservez-le : la référence ci-dessus est demandée pour toute réclamation.
</div>

<table class="pied">
    <tr>
        <td>
            <strong>{{ $evenement }}</strong><br>
            @if ($lieu){{ $lieu }}<br>@endif
            @if ($contactEmail){{ $contactEmail }}<br>@endif
            @if ($contactTelephone){{ $contactTelephone }}@endif
        </td>
        <td style="text-align: right;">
            Document généré automatiquement.<br>
            Aucune signature n&rsquo;est requise.
        </td>
    </tr>
</table>

</body>
</html>
