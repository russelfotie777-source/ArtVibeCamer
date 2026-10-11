<?php

namespace App\Http\Controllers\Api\V1\Site;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Http\Controllers\Controller;
use App\Http\Resources\TransactionResource;
use App\Models\Candidate;
use App\Models\Setting;
use App\Models\Transaction;
use App\Services\Payments\PaymentProcessor;
use Barryvdh\DomPDF\Facade\Pdf;
use Symfony\Component\HttpFoundation\Response;

class PaymentController extends Controller
{
    public function __construct(private readonly PaymentProcessor $payments) {}

    /**
     * Suivi d'un paiement par le payeur.
     *
     * Le front interroge cette route pendant que l'utilisateur valide sur son
     * telephone. Si la notification de la passerelle se fait attendre, on
     * verifie directement aupres d'elle plutot que de laisser l'ecran tourner
     * indefiniment.
     */
    public function show(Transaction $transaction)
    {
        /*
         * Le front interroge cette route pendant que le payeur valide. On ne
         * repercute pas chaque interrogation sur la passerelle : au plus une
         * verification par transaction et par intervalle, et seulement une
         * fois passe le temps de saisie du code.
         */
        if ($transaction->status->isAwaitingPayer()
            && $transaction->processing_at?->lt(now()->subSeconds(20))) {
            $transaction = $this->payments->refreshIfStale($transaction);
        }

        return TransactionResource::make($transaction)->additional([
            'meta' => ['candidate' => $this->candidat($transaction)],
        ]);
    }

    /**
     * Recu de paiement, en PDF.
     *
     * Accessible sans authentification, comme l'ecran de suivi : c'est la
     * reference — aleatoire et connue du seul payeur — qui autorise l'acces.
     * Un paiement non abouti n'a pas de recu : en delivrer un laisserait
     * croire a un encaissement qui n'a pas eu lieu.
     */
    public function recu(Transaction $transaction): Response
    {
        abort_unless($transaction->status === TransactionStatus::Succeeded, 404);

        $candidat = $transaction->type === TransactionType::Registration
            ? $transaction->payable
            : null;

        $pdf = Pdf::loadView('recus.paiement', [
            'transaction' => $transaction,
            'evenement' => Setting::get('event_name', config('app.name')),
            'sousTitre' => Setting::get('event_tagline'),
            'lieu' => collect([Setting::get('event_venue'), Setting::get('event_city')])
                ->filter()->implode(', ') ?: null,
            'contactEmail' => Setting::get('contact_email'),
            'contactTelephone' => Setting::get('contact_phone'),
            'designation' => $this->designation($transaction),
            'precision' => $candidat?->candidate_number
                ? 'Candidat n° '.$candidat->candidate_number
                : null,
            'montant' => $transaction->formattedAmount(),
            'payeur' => $transaction->payer_name ?: 'Non renseigné',
            'payeLe' => $transaction->paid_at?->timezone(config('app.timezone'))
                ->translatedFormat('j F Y à H\\hi') ?? '—',
            'emisLe' => now()->timezone(config('app.timezone'))->translatedFormat('j F Y'),
        ]);

        /*
         * Nom de fichier bati sur la reference : un payeur qui telecharge
         * plusieurs recus doit pouvoir les distinguer dans son dossier de
         * telechargements sans les ouvrir.
         */
        return $pdf->download('recu-'.$transaction->reference.'.pdf');
    }

    /** Ce qui a ete paye, en une ligne lisible sur le recu. */
    private function designation(Transaction $transaction): string
    {
        return match ($transaction->type) {
            TransactionType::Registration => 'Inscription au concours'
                .($transaction->payable?->category?->name
                    ? ' — catégorie '.$transaction->payable->category->name
                    : ''),
            TransactionType::Vote => 'Achat de voix'
                .($transaction->payable?->quantity
                    ? ' — '.$transaction->payable->quantity.' voix'
                    : ''),
            TransactionType::Ticket => 'Billetterie',
        };
    }

    /**
     * Resume du candidat pour une transaction d'inscription, afin que le
     * candidat voie son numero des la confirmation du paiement.
     *
     * Divulgation acceptable : la reference de transaction est aleatoire et
     * n'est connue que de lui. On s'en tient malgre tout au strict
     * necessaire, sans coordonnees personnelles.
     */
    private function candidat(Transaction $transaction): ?array
    {
        if ($transaction->type !== TransactionType::Registration) {
            return null;
        }

        $candidate = $transaction->payable;

        if (! $candidate instanceof Candidate) {
            return null;
        }

        return [
            'candidate_number' => $candidate->candidate_number,
            'display_name' => $candidate->display_name,
            'slug' => $candidate->slug,
            'status' => $candidate->status->value,
            'status_label' => $candidate->status->label(),
            'category' => $candidate->loadMissing('category')->category?->name,
            'registration_type_label' => $candidate->registration_type->label(),
            'members_count' => $candidate->members_count,
        ];
    }
}
