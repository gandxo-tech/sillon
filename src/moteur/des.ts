/**
 * Déterminisme : mêmes entrées, même sortie.
 *
 * Aucun Math.random() dans le moteur ni dans le rapport. Les choix de
 * formulation partent d'une graine calculée sur la parcelle et les cultures,
 * pour qu'un même champ rende toujours le même texte.
 */

/** FNV-1a 32 bits : rapide, stable, sans dépendance. */
export function hash32(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Graine stable à partir de plusieurs morceaux (coordonnées, cultures…). */
export function graineDepuis(...morceaux: (string | number)[]): number {
  const texte = morceaux
    .map((m) => (typeof m === 'number' ? m.toFixed(5) : m))
    .join('|');
  return hash32(texte);
}

/** Générateur pseudo-aléatoire semé (mulberry32), déterministe. */
export function mulberry32(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Index de variante : déterministe, et différent d'un emplacement à l'autre. */
export function indexVariante(graine: number, emplacement: string, taille: number): number {
  if (taille <= 0) return 0;
  return hash32(`${graine}|${emplacement}`) % taille;
}

/** Arrondi d'affichage : jamais plus de chiffres que ce que le calcul justifie. */
export const arrondi = (v: number, d = 0): number =>
  Number.isFinite(v) ? Number(v.toFixed(d)) : NaN;

export const nombre = (v: number, d = 0): string => {
  if (!Number.isFinite(v)) return 'non disponible';
  return v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
};
