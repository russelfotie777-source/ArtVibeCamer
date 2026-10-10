<?php

namespace App\Console\Commands;

use App\Models\Candidate;
use App\Models\Category;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Recalcule les compteurs denormalises depuis les tables de reference.
 *
 * `candidates.votes_count` et `categories.votes_count` sont tenus a jour par
 * incrementation a chaque paiement confirme : c'est ce qui permet d'afficher
 * un classement sans agreger des dizaines de milliers de lignes a chaque
 * visite. Le revers est qu'une derive est possible (incident, intervention
 * manuelle en base). Cette commande fait foi : la verite est dans `votes`.
 *
 * A passer en --dry-run avant la proclamation des resultats.
 */
class RecalculateCounters extends Command
{
    protected $signature = 'counters:recalculate {--dry-run : Affiche les ecarts sans rien modifier}';

    protected $description = 'Recalcule les compteurs de votes et de candidats depuis les donnees sources';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $drift = 0;

        $this->info('Candidats');

        // Somme des quantites des lots confirmes, par candidat.
        $actual = DB::table('votes')
            ->where('status', 'confirmed')
            ->select('candidate_id', DB::raw('SUM(quantity) AS total'))
            ->groupBy('candidate_id')
            ->pluck('total', 'candidate_id');

        foreach (Candidate::query()->select('id', 'candidate_number', 'votes_count')->cursor() as $candidate) {
            $expected = (int) ($actual[$candidate->id] ?? 0);

            if ($expected !== $candidate->votes_count) {
                $drift++;
                $this->warn(sprintf(
                    '  %s : %d en base, %d reel',
                    $candidate->candidate_number ?? "#{$candidate->id}",
                    $candidate->votes_count,
                    $expected,
                ));

                if (! $dryRun) {
                    Candidate::whereKey($candidate->id)->update(['votes_count' => $expected]);
                }
            }
        }

        $this->info('Categories');

        $categoryVotes = DB::table('votes')
            ->where('status', 'confirmed')
            ->select('category_id', DB::raw('SUM(quantity) AS total'))
            ->groupBy('category_id')
            ->pluck('total', 'category_id');

        $categoryCandidates = DB::table('candidates')
            ->whereNotNull('candidate_number')
            ->whereNull('deleted_at')
            ->select('category_id', DB::raw('COUNT(*) AS total'))
            ->groupBy('category_id')
            ->pluck('total', 'category_id');

        foreach (Category::query()->select('id', 'name', 'votes_count', 'candidates_count')->cursor() as $category) {
            $expectedVotes = (int) ($categoryVotes[$category->id] ?? 0);
            $expectedCandidates = (int) ($categoryCandidates[$category->id] ?? 0);

            if ($expectedVotes !== $category->votes_count || $expectedCandidates !== $category->candidates_count) {
                $drift++;
                $this->warn(sprintf(
                    '  %s : votes %d -> %d, candidats %d -> %d',
                    $category->name,
                    $category->votes_count, $expectedVotes,
                    $category->candidates_count, $expectedCandidates,
                ));

                if (! $dryRun) {
                    Category::whereKey($category->id)->update([
                        'votes_count' => $expectedVotes,
                        'candidates_count' => $expectedCandidates,
                    ]);
                }
            }
        }

        $this->newLine();

        if ($drift === 0) {
            $this->info('Aucun ecart : les compteurs sont coherents.');
        } else {
            $this->info($dryRun
                ? "{$drift} ecart(s) detecte(s). Relancez sans --dry-run pour corriger."
                : "{$drift} ecart(s) corrige(s).");
        }

        return self::SUCCESS;
    }
}
