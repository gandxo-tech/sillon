import { CONDITIONS } from '../../analyse/rotations';
import type { ContexteRotation } from '../../analyse/rotations';
import { CULTURES } from '../../data/cultures';
import { PRIORITES_DEFAUT } from '../moteur';
import type { EntreeMoteur } from '../moteur';

/** Érosivité de la pluie (Renard & Freimund), comme dans construireContexte. */
const erosivite = (pluieAnnuelle: number): number =>
  587.8 - 1.219 * pluieAnnuelle + 0.004105 * pluieAnnuelle * pluieAnnuelle;

const base = (
  surcharges: Partial<ContexteRotation> = {},
  pluieAnnuelle = 900,
): ContexteRotation => ({
  pluieSaison: 700,
  et0Saison: 1150,
  saisonJours: 200,
  pente: 2,
  kErosion: 0.3,
  rErosivite: erosivite(pluieAnnuelle),
  ph: 6.2,
  argile: 24,
  sable: 40,
  awcMm: 60,
  irrigation: 0,
  ...surcharges,
});

export interface ScenarioTest {
  nom: string;
  entree: EntreeMoteur;
}

const entree = (surcharges: Partial<EntreeMoteur> = {}): EntreeMoteur => ({
  ctx: base(),
  condition: CONDITIONS[0],
  priorites: { ...PRIORITES_DEFAUT },
  cheptel: false,
  capital: 'faible',
  historique: [],
  actuelle: [CULTURES.sorgho, CULTURES.niebe],
  lat: 13.5123,
  lon: 2.1234,
  ...surcharges,
});

/** Les cinq cas du livrable, plus le jumeau opposé du cas 4. */
export const CAS_1: ScenarioTest = {
  nom: 'Parcelle sèche, priorité revenu',
  entree: entree({
    ctx: base({ pluieSaison: 400, et0Saison: 1000, awcMm: 35 }, 520),
    priorites: { ...PRIORITES_DEFAUT, revenu: 100, sobrieteEau: 0, securiteAlimentaire: 30 },
    actuelle: [CULTURES.sorgho, CULTURES.mil],
  }),
};

export const CAS_2: ScenarioTest = {
  nom: 'Sans cheptel déclaré',
  entree: entree({
    ctx: base({ pluieSaison: 750, et0Saison: 1150, awcMm: 70 }, 900),
    cheptel: false,
    // La luzerne est déclarée par l'exploitant : c'est elle qui doit être écartée.
    actuelle: [CULTURES.mais, CULTURES.niebe, CULTURES.luzerne],
  }),
};

export const CAS_3: ScenarioTest = {
  nom: 'Historique contenant du maïs',
  entree: entree({
    ctx: base({ pluieSaison: 820, et0Saison: 1100, awcMm: 75 }, 1000),
    cheptel: true,
    capital: 'moyen',
    historique: ['sorgho', 'niébé', 'maïs'],
    actuelle: [CULTURES.mais, CULTURES.niebe],
  }),
};

export const CAS_4A: ScenarioTest = {
  nom: 'Priorité argent (cas 4, jeu A)',
  entree: entree({
    ctx: base({ pluieSaison: 680, et0Saison: 1150, awcMm: 55 }, 850),
    priorites: { ...PRIORITES_DEFAUT, revenu: 100, securiteAlimentaire: 10, sobrieteEau: 10, autonomieIntrants: 10 },
    // Quatre cultures : avec deux seulement, l'ordre ne peut pas traduire les priorités.
    actuelle: [CULTURES.mil, CULTURES.niebe, CULTURES.sorgho, CULTURES.arachide],
  }),
};

export const CAS_4B: ScenarioTest = {
  nom: 'Priorité nourrir et économiser (cas 4, jeu B)',
  entree: entree({
    ctx: base({ pluieSaison: 680, et0Saison: 1150, awcMm: 55 }, 850),
    priorites: { ...PRIORITES_DEFAUT, revenu: 10, securiteAlimentaire: 100, sobrieteEau: 100, autonomieIntrants: 100 },
    actuelle: [CULTURES.mil, CULTURES.niebe, CULTURES.sorgho, CULTURES.arachide],
  }),
};

export const CAS_5: ScenarioTest = {
  nom: 'Parcelle humide, cheptel, budget moyen',
  entree: entree({
    ctx: base({ pluieSaison: 1050, et0Saison: 1050, awcMm: 90, ph: 6.6 }, 1300),
    cheptel: true,
    capital: 'moyen',
    historique: ['niebe', 'sorgho'],
    actuelle: [CULTURES.mais, CULTURES.arachide],
    lat: 9.6412,
    lon: 1.7312,
  }),
};

/** Les cinq entrées qui comptent pour le tableau de répartition. */
export const CAS_TABLEAU: ScenarioTest[] = [CAS_1, CAS_2, CAS_3, CAS_4A, CAS_5];
