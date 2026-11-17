"use client";

import { useEffect, useRef, useState } from "react";
import { scannerBillet, chargerStatsScan } from "@/app/admin/actions";
import { dateHeure, nombre } from "@/lib/format";
import type { JournalScanRecent, ReponseScan, ReponseStatsScan } from "@/lib/types";

// Portes d'entree predefinies pour faciliter le poste de chaque agent.
const PORTES = [
  "Entrée principale",
  "Porte VIP",
  "Entrée artistes & presse",
  "Accès coupe-file",
];

// Synthese sonore par Web Audio API sans aucun telechargement de fichier.
function emettreSon(succes: boolean) {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();

    if (succes) {
      // Double note ascendante joyeuse et discrete (A5 -> E6).
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.22);
    } else {
      // Double coup de vibreur grave descendant (signal de refus franc).
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
      osc.frequency.setValueAtTime(160, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    }
  } catch {
    // Navigateur refusant l'audio sans geste prealable.
  }
}

// Vibration haptique sur telephone mobile.
function vibrer(succes: boolean) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      if (succes) {
        navigator.vibrate(120);
      } else {
        navigator.vibrate([200, 100, 200]);
      }
    }
  } catch {
    // Vibration indisponible.
  }
}

// Module client interactif de controle d'entree : camera, saisie, verdict et compteurs.
export function ScannerEntree({
  statsInitiales,
}: {
  statsInitiales: ReponseStatsScan | null;
}) {
  const [stats, setStats] = useState<ReponseStatsScan | null>(statsInitiales);
  const [porte, setPorte] = useState(() => {
    if (typeof window === "undefined") return "Entrée principale";
    try {
      return localStorage.getItem("avc_gate_scan") || "Entrée principale";
    } catch {
      return "Entrée principale";
    }
  });
  const [saisieManuelle, setSaisieManuelle] = useState("");
  const [verdict, setVerdict] = useState<ReponseScan | null>(null);
  const [chargement, setChargement] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [erreurCamera, setErreurCamera] = useState<string | null>(null);
  const [historique, setHistorique] = useState<JournalScanRecent[]>(
    statsInitiales?.recent ?? [],
  );

  // Reference vers l'instance active de html5-qrcode.
  const scannerRef = useRef<unknown>(null);
  const traitementEnCours = useRef(false);

  function changerPorte(nouvellePorte: string) {
    setPorte(nouvellePorte);
    try {
      localStorage.setItem("avc_gate_scan", nouvellePorte);
    } catch {
      // Ignorer.
    }
  }

  // Traitement d'un code scanne ou saisi.
  async function traiterCode(codeBrut: string) {
    const code = codeBrut.trim();
    if (!code || traitementEnCours.current) return;

    traitementEnCours.current = true;
    setChargement(true);

    try {
      const resultat = await scannerBillet(code, porte);
      setVerdict(resultat);
      emettreSon(resultat.granted);
      vibrer(resultat.granted);

      // Ajoute a l'historique recent de la session.
      setHistorique((prev) => [
        {
          code: resultat.ticket?.code ?? code.slice(0, 16),
          result: resultat.result,
          result_label: resultat.message,
          gate: porte,
          agent: null,
          scanned_at: new Date().toISOString(),
        },
        ...prev.slice(0, 14),
      ]);

      // Rafraichit les compteurs du serveur.
      const statsFrais = await chargerStatsScan();
      if (statsFrais) {
        setStats(statsFrais);
        if (statsFrais.recent.length > 0) {
          setHistorique(statsFrais.recent);
        }
      }
    } catch {
      // Erreur de communication.
      const repli: ReponseScan = {
        granted: false,
        result: "not_found",
        message: "Erreur de communication avec le serveur.",
        ticket: null,
      };
      setVerdict(repli);
      emettreSon(false);
      vibrer(false);
    } finally {
      setChargement(false);
      // Debloque la reception apres une petite seconde pour eviter les doublons de capture.
      setTimeout(() => {
        traitementEnCours.current = false;
      }, 1200);
    }
  }

  const traiterCodeRef = useRef(traiterCode);
  useEffect(() => {
    traiterCodeRef.current = traiterCode;
  });

  // Initialisation dynamique de la camera avec html5-qrcode.
  useEffect(() => {
    let actif = true;

    async function initialiserCamera() {
      if (!cameraActive) return;

      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        // Attendre que l'element DOM soit reellement disponible.
        const conteneur = document.getElementById("lecteur-camera");
        if (!conteneur || !actif) return;

        // Arreter l'ancienne instance si elle existait.
        if (scannerRef.current) {
          try {
            const ancien = scannerRef.current as {
              isScanning?: boolean;
              stop: () => Promise<void>;
              clear: () => void;
            };
            if (ancien.isScanning) {
              await ancien.stop();
            }
            ancien.clear();
          } catch {
            // Ignorer.
          }
        }

        const scanner = new Html5Qrcode("lecteur-camera");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 12,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (texteDecode) => {
            if (!traitementEnCours.current) {
              void traiterCodeRef.current(texteDecode);
            }
          },
          () => {
            // Ignorer les erreurs d'analyse par trame.
          },
        );

        setErreurCamera(null);
      } catch {
        if (actif) {
          setErreurCamera(
            "Accès caméra refusé ou indisponible. Vous pouvez saisir les codes manuellement.",
          );
        }
      }
    }

    void initialiserCamera();

    return () => {
      actif = false;
      if (scannerRef.current) {
        try {
          const ancien = scannerRef.current as {
            isScanning?: boolean;
            stop: () => Promise<void>;
            clear: () => void;
          };
          if (ancien.isScanning) {
            void ancien.stop();
          }
          ancien.clear();
        } catch {
          // Ignorer.
        }
      }
    };
  }, [cameraActive]);

  // Fermeture automatique du verdict plein ecran apres 3 secondes.
  useEffect(() => {
    if (!verdict) return;

    const timer = setTimeout(() => {
      setVerdict(null);
    }, 3200);

    return () => clearTimeout(timer);
  }, [verdict]);

  const { entrance } = stats ?? {
    entrance: {
      tickets_issued: 0,
      checked_in: 0,
      remaining: 0,
      rate: 0,
      rejected_scans: 0,
      last_hour: 0,
    },
  };

  const tauxEntree =
    entrance.tickets_issued > 0
      ? Math.round((entrance.checked_in / entrance.tickets_issued) * 100)
      : 0;

  return (
    <div className="relative space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* RETOUR VISUEL PLEIN ECRAN IMMEDIAT (VERT / ROUGE)             */}
      {/* ------------------------------------------------------------- */}
      {verdict ? (
        <div
          role="alert"
          onClick={() => setVerdict(null)}
          className={`fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-between p-6 text-white transition-all duration-200 ${
            verdict.granted
              ? "bg-[#11953f]" // Vert succes eclatant
              : "bg-[#c70e20]" // Rouge alerte eclatant
          }`}
        >
          <div className="text-center pt-8">
            <span className="rounded-pilule bg-white/20 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white">
              {porte}
            </span>
          </div>

          <div className="flex flex-col items-center text-center max-w-lg">
            {/* Symbole d'acceptation ou de rejet */}
            <div className="flex size-28 items-center justify-center rounded-full border-4 border-white/60 bg-white/20 text-6xl font-black">
              {verdict.granted ? "✓" : "✕"}
            </div>

            <h1 className="mt-6 text-4xl sm:text-5xl font-black tracking-affiche uppercase">
              {verdict.granted ? "Entrée autorisée" : "Accès refusé"}
            </h1>

            <p className="mt-2 text-xl font-semibold opacity-95">
              {verdict.message}
            </p>

            {/* Fiche du billet controle */}
            {verdict.ticket ? (
              <div className="mt-6 w-full rounded-surface bg-black/25 p-5 text-left border border-white/20">
                <div className="flex items-center justify-between border-b border-white/20 pb-2">
                  <span className="text-xs uppercase tracking-wider opacity-80">
                    Catégorie
                  </span>
                  <span className="text-lg font-bold">
                    {verdict.ticket.type ?? "Standard"}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between border-b border-white/20 pb-2">
                  <span className="text-xs uppercase tracking-wider opacity-80">
                    Porteur
                  </span>
                  <span className="font-semibold text-lg">
                    {verdict.ticket.holder_name ?? "Anonyme"}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider opacity-80">
                    Code billet
                  </span>
                  <span className="chiffre font-mono font-bold tracking-widest">
                    {verdict.ticket.code}
                  </span>
                </div>

                {verdict.ticket.used_at ? (
                  <p className="mt-3 pt-2 border-t border-white/20 text-xs text-yellow-200">
                    Déjà scanné le {dateHeure(verdict.ticket.used_at)} (Tentative #{verdict.ticket.scan_count})
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="pb-8 text-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setVerdict(null);
              }}
              className="rounded-controle bg-white px-8 py-3 text-base font-bold text-neutral-900 shadow-lg hover:bg-neutral-100"
            >
              Billet suivant →
            </button>
            <p className="mt-2 text-xs opacity-75">
              Reprise automatique dans un instant ou touchez l’écran
            </p>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------- */}
      {/* BARRE DE COMPTEURS EN TEMPS REEL                              */}
      {/* ------------------------------------------------------------- */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-region border border-bordure bg-surface p-4">
          <p className="text-xs uppercase tracking-wider text-discret">
            Entrées validées
          </p>
          <p className="montant mt-1 text-3xl font-bold text-accent">
            {nombre(entrance.checked_in)}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-appui">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${tauxEntree}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-discret">
            {tauxEntree}% sur {nombre(entrance.tickets_issued)} vendus
          </p>
        </div>

        <div className="rounded-region border border-bordure bg-surface p-4">
          <p className="text-xs uppercase tracking-wider text-discret">
            Restants à entrer
          </p>
          <p className="montant mt-1 text-3xl font-bold text-fort">
            {nombre(entrance.remaining)}
          </p>
          <p className="mt-3 text-[11px] text-discret">Billets non encore scannés</p>
        </div>

        <div className="rounded-region border border-bordure bg-surface p-4">
          <p className="text-xs uppercase tracking-wider text-discret">
            Refus / Alertes
          </p>
          <p className="montant mt-1 text-3xl font-bold text-danger">
            {nombre(entrance.rejected_scans)}
          </p>
          <p className="mt-3 text-[11px] text-discret">Doublons ou codes erronés</p>
        </div>

        <div className="rounded-region border border-bordure bg-surface p-4">
          <p className="text-xs uppercase tracking-wider text-discret">
            Débit d’entrée
          </p>
          <p className="montant mt-1 text-3xl font-bold text-lien">
            {nombre(entrance.rate)}
          </p>
          <p className="mt-3 text-[11px] text-discret">Entrées par heure</p>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* SELECTION DU POSTE / PORTE DE CONTROLE                        */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-region border border-bordure bg-surface p-3">
        <label htmlFor="selecteur-porte" className="text-sm font-semibold text-fort">
          Poste de contrôle :
        </label>
        <select
          id="selecteur-porte"
          value={porte}
          onChange={(e) => changerPorte(e.target.value)}
          className="rounded-controle border border-bordure-forte bg-surface px-3 py-1.5 text-sm text-fort focus:border-focus"
        >
          {PORTES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SCANNER CAMERA ET SAISIE MANUELLE                             */}
      {/* ------------------------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Cadre de la camera */}
        <section className="rounded-region border border-bordure bg-surface p-6 flex flex-col items-center text-center">
          <div className="flex w-full items-center justify-between border-b border-bordure pb-3 mb-4">
            <h2 className="text-lg font-semibold text-fort">
              Scanner de caméra en direct
            </h2>
            <button
              type="button"
              onClick={() => setCameraActive(!cameraActive)}
              className="text-xs font-semibold text-lien underline hover:text-accent"
            >
              {cameraActive ? "Arrêter la caméra" : "Démarrer la caméra"}
            </button>
          </div>

          {cameraActive ? (
            <div className="relative w-full max-w-sm aspect-square overflow-hidden rounded-region border-2 border-accent bg-black shadow-inner">
              <div id="lecteur-camera" className="size-full" />
              {/* Viseur visuel de centrage */}
              <div className="pointer-events-none absolute inset-6 border-2 border-dashed border-accent/70 rounded-region flex items-center justify-center">
                <span className="text-xs uppercase tracking-widest text-white/60 bg-black/50 px-2 py-1 rounded">
                  Placez le QR Code ici
                </span>
              </div>
            </div>
          ) : (
            <div className="flex aspect-square w-full max-w-sm items-center justify-center rounded-region border border-bordure bg-appui text-sm text-discret">
              Caméra en pause
            </div>
          )}

          {erreurCamera ? (
            <p className="mt-3 text-xs text-danger">{erreurCamera}</p>
          ) : null}

          {/* Formulaire de saisie manuelle de secours */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void traiterCode(saisieManuelle);
              setSaisieManuelle("");
            }}
            className="mt-6 w-full max-w-sm"
          >
            <label
              htmlFor="saisie-code"
              className="block text-xs uppercase tracking-wider text-discret mb-1.5 text-left font-semibold"
            >
              Code dictable de secours (si écran fissuré)
            </label>
            <div className="flex gap-2">
              <input
                id="saisie-code"
                type="text"
                placeholder="AVC-T-XXXXXX"
                value={saisieManuelle}
                onChange={(e) => setSaisieManuelle(e.target.value.toUpperCase())}
                className="chiffre font-mono flex-1 rounded-controle border border-bordure-forte bg-surface px-3 py-2 text-base text-fort placeholder:text-discret uppercase"
              />
              <button
                type="submit"
                disabled={chargement || !saisieManuelle.trim()}
                className="appui rounded-controle bg-accent px-4 text-sm font-semibold text-sur-accent hover:bg-accent-survol disabled:opacity-40"
              >
                {chargement ? "Vérification…" : "Valider"}
              </button>
            </div>
          </form>
        </section>

        {/* Historique recent des scans */}
        <aside className="rounded-region border border-bordure bg-surface p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-discret border-b border-bordure pb-3">
            Derniers scans réalisés
          </h3>

          {historique.length === 0 ? (
            <p className="mt-4 text-xs text-discret">
              Aucun scan enregistré pour l’instant sur cette session.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-bordure max-h-[380px] overflow-y-auto pr-1">
              {historique.map((item, idx) => {
                const estAccepte = item.result === "accepted";
                return (
                  <div
                    key={`${item.code}-${idx}`}
                    className="py-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="chiffre font-mono font-semibold text-fort">
                        {item.code}
                      </span>
                      <p className="text-[11px] text-discret">
                        {item.scanned_at ? dateHeure(item.scanned_at) : "À l’instant"}
                        {item.gate ? ` · ${item.gate}` : ""}
                      </p>
                    </div>

                    <span
                      className={`chiffre rounded-pilule px-2 py-0.5 text-[10px] font-semibold ${
                        estAccepte
                          ? "bg-succes-fond text-succes"
                          : "bg-danger-fond text-danger"
                      }`}
                    >
                      {estAccepte ? "✓ Validé" : "✕ Refusé"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
