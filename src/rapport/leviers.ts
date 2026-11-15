/**
 * Ce que l'exploitant peut changer quand ses rotations ne passent pas.
 *
 * Le moteur écarte chaque cas avec un code ; ce module traduit ces codes en
 * gestes concrets, classés par nombre de cas débloqués. Un rejet n'est donc
 * jamais une fin de non-recevoir : il ouvre une action.
 *
 * Aucun chiffre n'est inventé ici : les comptages viennent de `sortie.rejets`,
 * les montants restent dans les phrases de rejet (bloc technique).
 */

import type { CodeRejet, SortieMoteur } from '../moteur/moteur';

export interface Levier {
  code: CodeRejet;
  /** Nombre de rotations écartées pour ce motif. */
  cas: number;
  action: string;
}

/**
 * Un geste par motif de rejet.
 *
 * Ordre de rédaction : ce qui se fait avant les semis d'abord, les arbitrages
 * d'argent ensuite, la technique culturale en dernier.
 */
const ACTIONS: Record<CodeRejet, string> = {
  EAU:
    'Cherchez de l’eau avant d’allonger la rotation : réduisez la surface, semez dès que la pluie s’installe, et préférez la culture la plus résistante à la sécheresse de votre liste.',
  CAPITAL:
    'Étalez les achats : commencez par la culture la moins gourmande en intrants, et gardez la plus chère pour l’année où la récolte précédente a payé.',
  MARCHE:
    'Ne semez pas une culture fourragère sans débouché : trouvez l’éleveur qui l’achète avant de semer, ou retirez-la de la rotation.',
  RETOUR:
    'Allongez le délai avant de revenir sur une culture : laissez passer le nombre d’années indiqué dans les rejets, sinon la même famille revient trop tôt et le sol s’épuise.',
  PH:
    'Faites analyser le pH et corrigez-le avant de semer une culture exigeante ; en attendant, restez sur celles qui tolèrent votre terre.',
  EROSION:
    'Sur cette pente, semez en travers et laissez des bandes enherbées : sans cela, la terre s’en va plus vite qu’elle ne se reforme.',
  CYCLE:
    'Choisissez une variété plus précoce : en l’état, la succession ne tient pas dans votre saison.',
};

/** Départage à nombre de cas égal : le plus structurant d'abord. */
const ORDRE: CodeRejet[] = ['EAU', 'CAPITAL', 'MARCHE', 'RETOUR', 'PH', 'EROSION', 'CYCLE'];

/**
 * Trois leviers au maximum, du plus débloquant au moins débloquant.
 * Déterministe : même sortie de moteur, mêmes leviers.
 */
export function leviers(sortie: SortieMoteur): Levier[] {
  const comptes = new Map<CodeRejet, number>();
  for (const rejet of sortie.rejets) {
    comptes.set(rejet.code, (comptes.get(rejet.code) ?? 0) + 1);
  }

  return [...comptes.entries()]
    .filter(([, cas]) => cas > 0)
    .sort((a, b) => b[1] - a[1] || ORDRE.indexOf(a[0]) - ORDRE.indexOf(b[0]))
    .slice(0, 3)
    .map(([code, cas]) => ({ code, cas, action: ACTIONS[code] }));
}

/** Phrase de contexte pour le conseil IA : ce qui bloque, et par quoi commencer. */
export function resumeLeviers(liste: Levier[]): string | null {
  if (!liste.length) return null;
  const premier = liste[0];
  return `Ce qui bloque le plus : ${premier.cas} rotation${premier.cas > 1 ? 's' : ''} écartée${premier.cas > 1 ? 's' : ''} sur ce motif. Première action : ${premier.action}`;
}
