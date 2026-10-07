/**
 * Bande de motif inspiree de la broderie du toghu : losanges concentriques et
 * crochets, dessines au trait plutot que remplis, comme un fil sur le tissu.
 *
 * Regle du projet : le motif apparait une seule fois par page, comme element
 * de structure (bandeau de tete, separateur de section). Jamais en fond
 * decoratif derriere du contenu.
 */
export function BandeMotif({
  hauteur = 14,
  couleur = "var(--color-brass)",
  opacite = 1,
  className = "",
}: {
  hauteur?: number;
  couleur?: string;
  opacite?: number;
  className?: string;
}) {
  const id = `toghu-${hauteur}`;

  return (
    <svg
      aria-hidden="true"
      className={`block w-full ${className}`}
      height={hauteur}
      preserveAspectRatio="none"
      style={{ opacity: opacite }}
    >
      <defs>
        <pattern
          id={id}
          width="28"
          height={hauteur}
          patternUnits="userSpaceOnUse"
        >
          <g
            fill="none"
            stroke={couleur}
            strokeWidth="1.1"
            strokeLinejoin="round"
          >
            {/* Losange exterieur */}
            <path d={`M14 1 L27 ${hauteur / 2} L14 ${hauteur - 1} L1 ${hauteur / 2} Z`} />
            {/* Losange interieur */}
            <path
              d={`M14 ${hauteur * 0.3} L20 ${hauteur / 2} L14 ${hauteur * 0.7} L8 ${hauteur / 2} Z`}
            />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
