import type { Profil } from './features';
import { CULTURES } from '../data/cultures';
import type { Culture } from '../data/cultures';

export type { Culture } from '../data/cultures';
export { CULTURES, CULTURES_LISTE } from '../data/cultures';

export interface DefinitionScenario {
  id: string;
  nom: string;
  accroche: string;
  role: string;
  cycle: string[];
  /** Cultures déjà résolues, pour une rotation saisie librement. */
  cultures?: Culture[];
  /** Vrai si l'une des cultures est hors base : coefficients génériques. */
  approx?: boolean;
}

export interface Condition {
  id: 'actuel' | 'secheresse' | 'chaud' | 'projection' | 'custom';
  nom: string;
  pluiePct: number;
  tempDelta: number;
}

export const CONDITIONS: Condition[] = [
  { id: 'actuel', nom: 'Climat observé', pluiePct: 0, tempDelta: 0 },
  { id: 'secheresse', nom: '−20 % de pluie', pluiePct: -20, tempDelta: 0 },
  { id: 'chaud', nom: '+2 °C', pluiePct: 0, tempDelta: 2 },
];

export interface ResultatRotation {
  def: DefinitionScenario;
  cultures: Culture[];
  demandeEau: number;
  apportEau: number;
  deficit: number;
  stress: number;
  rendement: number;
  erosion: number;
  marge: number;
  margeBasse: number;
  margeHaute: number;
  azote: number;
  mo10: number;
  diversite: number;
  rupture: number;
  scores: { eau: number; sol: number; revenu: number; risque: number; azote: number };
  scoreGlobal: number;
  viable: boolean;
  blocages: string[];
  atouts: string[];
}

const bornes = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const moy = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export interface ContexteRotation {
  pluieSaison: number;
  et0Saison: number;
  saisonJours: number;
  pente: number | null;
  kErosion: number;
  rErosivite: number;
  ph: number;
  argile: number;
  sable: number;
  awcMm: number;
  irrigation: number;
}

export function construireContexte(p: Profil, irrigation = 0): ContexteRotation {
  const pluieAnnuelle = Math.min(2400, Math.max(150, p.climat.pluieAnnuelle));
  return {
    pluieSaison: p.climat.pluieSaison,
    et0Saison: p.climat.et0Saison,
    saisonJours: p.saison.duree,
    pente: p.relief.pente,
    kErosion: p.sol.kErosion,
    rErosivite: 587.8 - 1.219 * pluieAnnuelle + 0.004105 * pluieAnnuelle * pluieAnnuelle,
    ph: p.sol.ph,
    argile: p.sol.argile,
    sable: p.sol.sable,
    awcMm: p.sol.awcMm,
    irrigation,
  };
}

/**
 * Calcul agronomique d'une succession : eau, rendement, érosion, matière
 * organique, azote. Le moteur de décision s'appuie dessus sans le réécrire ;
 * RUSLE reste ici, à un seul endroit.
 */
export function calculerScenario(
  def: DefinitionScenario,
  ctx: ContexteRotation,
  condition: Condition,
): ResultatRotation {
  const cultures = def.cultures ?? def.cycle.map((id) => CULTURES[id]);
  const parId = new Map(cultures.map((c) => [c.id, c]));
  const n = cultures.length;

  const facteurPluie = 1 + condition.pluiePct / 100;
  const pluieSaison = ctx.pluieSaison * facteurPluie;
  const et0Saison = ctx.et0Saison * (1 + 0.045 * condition.tempDelta);

  const demandeEau = moy(cultures.map((c) => et0Saison * c.kc * c.partSaison));
  const reserveMobilisable = ctx.awcMm * moy(cultures.map((c) => c.facteurReserve));
  const apportEau = pluieSaison * 0.85 + reserveMobilisable + ctx.irrigation;
  const deficit = Math.max(0, demandeEau - apportEau);
  const stress = demandeEau > 0 ? deficit / demandeEau : 0;
  const tolerance = moy(cultures.map((c) => c.toleranceSecheresse));
  const perte = stress > 0 ? (0.95 - 0.42 * tolerance) * Math.pow(stress, 0.85) : 0;
  // Le rendement est une fraction (0,35 à 1) : la borne basse est 0,35, pas 35.
  const rendement = bornes(1 - perte, 0.35, 1);

  const penteFraction = (ctx.pente ?? 2) / 100;
  const ls = (100 / 22.13) ** 0.4 * (0.065 + 4.56 * penteFraction + 65.41 * penteFraction ** 2);
  const facteurC = moy(cultures.map((c) => c.facteurC));
  const erosion = Math.max(0.1, (ctx.rErosivite * ctx.kErosion * ls * facteurC * 1.0) / 10);

  const azote = Math.max(
    0,
    moy(cultures.map((c) => c.azoteDemande)) - moy(cultures.map((c) => c.azoteFixe)) * 0.55,
  );
  const produit =
    cultures.reduce((s, c) => s + (c.marge > 0 ? c.marge * rendement : c.marge), 0) / n;
  const marge = produit - azote * 1.15 - ctx.irrigation * 0.4;

  const couverture = moy(cultures.map((c) => c.couverture));
  const residus = moy(cultures.map((c) => c.residus));
  const mo10 = 10 * (0.018 * (residus - 3.2) + (couverture > 0.9 ? 0.03 : 0));

  const occurrences = new Map<string, number>();
  for (const c of cultures) occurrences.set(c.id, (occurrences.get(c.id) ?? 0) + 1);

  const diversite = occurrences.size;
  let rupture = 0;
  for (const [id, nombre] of occurrences) {
    const culture = parId.get(id)!;
    const intervalle = culture.perenne ? n : n / nombre;
    rupture += Math.min(1, intervalle / culture.retour) * nombre;
  }
  rupture /= n;

  /* Aptitude réelle du lieu */
  const blocages: string[] = [];
  const atouts: string[] = [];

  const tropCourt = cultures.filter((c) => c.besoinJours > ctx.saisonJours + 15);
  if (tropCourt.length) {
    blocages.push(
      `Cycle trop long pour une saison de ${Math.round(ctx.saisonJours)} jours : ${[
        ...new Set(tropCourt.map((c) => c.court)),
      ].join(', ')}.`,
    );
  }
  const phHors = cultures.filter((c) => ctx.ph < c.phMin || ctx.ph > c.phMax);
  if (phHors.length) {
    blocages.push(
      `pH ${ctx.ph.toFixed(1)} hors de la plage de ${[...new Set(phHors.map((c) => c.court))].join(', ')}.`,
    );
  }
  if (stress > 0.32) {
    blocages.push(
      `Déficit hydrique de ${Math.round(deficit)} mm impossible à couvrir sans irrigation supplémentaire.`,
    );
  }
  if (ctx.pente !== null && ctx.pente > 8 && erosion > 7) {
    blocages.push('Pente forte combinée à un couvert insuffisant : érosion hors seuil.');
  }
  for (const [id, nombre] of occurrences) {
    const culture = parId.get(id)!;
    if (culture.perenne) continue;
    const intervalle = n / nombre;
    // Une culture revient trop tôt seulement si l'écart tombe sous 60 % du
    // délai conseillé : une alternance courte reste praticable, une répétition non.
    if (intervalle < culture.retour * 0.6) {
      blocages.push(
        `Retour sur ${culture.court} tous les ${intervalle.toLocaleString('fr-FR', {
          maximumFractionDigits: 1,
        })} an(s), sous le minimum de ${culture.retour} ans : pression parasitaire à surveiller.`,
      );
    }
  }

  if (erosion <= 5) atouts.push(`Érosion estimée à ${erosion.toFixed(1)} t/ha/an, sous le seuil tolérable.`);
  if (mo10 > 0.15) atouts.push(`Gain de matière organique de ${mo10.toFixed(2)} point en 10 ans.`);
  if (diversite >= 3) atouts.push(`${diversite} cultures différentes dans le cycle : ravageurs et adventices désynchronisés.`);
  if (azote < 60) atouts.push(`Seulement ${Math.round(azote)} kg N/ha à acheter grâce aux légumineuses.`);
  if (stress < 0.12) atouts.push('Demande en eau couverte par la pluie de saison.');

  const viable = blocages.length === 0;

  const efficience = demandeEau > 0 ? Math.min(1, apportEau / demandeEau) : 1;
  const scores = {
    eau: bornes(100 * efficience ** 0.8 * (0.86 + 0.14 * tolerance) - 25 * stress),
    sol: bornes(0.55 * bornes(100 * (1 - erosion / 9)) + 0.25 * bornes(50 + mo10 * 200) + 0.2 * bornes(100 - azote * 0.45)),
    revenu: bornes(marge / 9.5),
    risque: bornes(0.4 * bornes(100 - 115 * stress) + 0.3 * rupture * 100 + 0.3 * (100 - moy(cultures.map((c) => c.facteurC)) * 120)),
    azote: bornes(100 - azote * 0.45),
  };

  let scoreGlobal = 0.28 * scores.eau + 0.26 * scores.sol + 0.28 * scores.revenu + 0.18 * scores.risque;

  const incertitude = 0.12 + stress * 0.3;

  return {
    def,
    cultures,
    demandeEau,
    apportEau,
    deficit,
    stress,
    rendement,
    erosion,
    marge,
    margeBasse: marge * (1 - incertitude),
    margeHaute: marge * (1 + incertitude),
    azote,
    mo10,
    diversite,
    rupture,
    scores,
    scoreGlobal: bornes(scoreGlobal),
    viable,
    blocages,
    atouts,
  };
}

/** Nom usuel saisi par l'utilisateur → culture de la base. */
const SYNONYMES: Record<string, string> = {
  corn: 'mais',
  'mais grain': 'mais',
  'mais ensilage': 'mais',
  'mais precoce': 'mais_court',
  froment: 'ble',
  'ble dur': 'ble',
  'ble tendre': 'ble',
  orge: 'ble',
  avoine: 'ble',
  triticale: 'ble',
  'sorgho fourrager': 'sorgho',
  alfalfa: 'luzerne',
  feverole: 'pois',
  'pois fourrager': 'pois',
  'engrais vert': 'couvert',
  seigle: 'couvert',
  'mucuna pruriens': 'mucuna',
  cassava: 'manioc',
  manioc: 'manioc',
  cowpea: 'niebe',
  'niebe': 'niebe',
  niébé: 'niebe',
  peanut: 'arachide',
  groundnut: 'arachide',
  arachide: 'arachide',
  yam: 'igname',
  igname: 'igname',
  vesce: 'couvert',
  moutarde: 'couvert',
  phacelie: 'couvert',
  trefle: 'couvert',
  'ray grass': 'couvert',
  'petit mil': 'petit_mil',
  millet: 'mil',
  'mil chandelle': 'mil',
  sorghum: 'sorgho',
  sesame: 'sesame',
  'patate douce': 'patate_douce',
  'sweet potato': 'patate_douce',
  taro: 'taro',
  macabo: 'taro',
  'haricot vert': 'haricot',
  beans: 'haricot',
  'pois bambara': 'dolique',
  bambara: 'dolique',
  brachiaria: 'brachiaria',
  'herbe a elephants': 'brachiaria',
  fonio: 'fonio',
  crotalaire: 'crotalaire',
  'crotalaria': 'crotalaire',
};

export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const titreCase = (texte: string) => {
  const t = texte.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
};

/** Coefficients moyens pour une culture absente de la base. */
function cultureGenerique(texte: string): Culture {
  const court = titreCase(texte).slice(0, 20) || 'Culture libre';
  return {
    id: `perso:${normaliser(texte).replace(/ /g, '-') || 'libre'}`,
    nom: court,
    court,
    picto: 'X',
    teinte: '#8b96f5',
    famille: 'Hors base',
    kc: 0.88,
    partSaison: 0.8,
    besoinJours: 120,
    azoteDemande: 120,
    azoteFixe: 0,
    residus: 3.5,
    couverture: 0.7,
    facteurC: 0.22,
    marge: 600,
    toleranceSecheresse: 0.5,
    facteurReserve: 1.0,
    retour: 2,
    phMin: 5.5,
    phMax: 8.0,
    travailJoursHa: 45,
    coutIntrantFcfaHa: 90000,
    marche: 'marche',
    caloriesMcalHa: 2500,
    typeCulture: 'cereale',
    source: 'estime',
  };
}

export interface CultureResolue {
  culture: Culture;
  /** Vrai si le texte saisi ne correspond à aucune culture connue. */
  approx: boolean;
}

/** Accepte un identifiant de la base, un nom usuel, ou un texte libre. */
export function resoudreCulture(texte: string): CultureResolue {
  const brut = (texte ?? '').trim();
  const cle = normaliser(brut);
  if (!cle) return { culture: CULTURES.mais, approx: false };

  const direct = Object.values(CULTURES).find(
    (c) => normaliser(c.id) === cle || normaliser(c.nom) === cle || normaliser(c.court) === cle,
  );
  if (direct) return { culture: direct, approx: false };

  const viaSynonyme = SYNONYMES[cle];
  if (viaSynonyme) {
    // On garde les coefficients de la culture proche, mais le nom saisi.
    return { culture: { ...CULTURES[viaSynonyme], court: titreCase(brut) }, approx: false };
  }

  // Saisie partielle : « maïs », « soja bio »…
  const contenu = Object.values(CULTURES).find(
    (c) => cle.length >= 3 && (cle.includes(normaliser(c.court)) || normaliser(c.court).includes(cle)),
  );
  if (contenu) return { culture: { ...contenu, court: titreCase(brut) }, approx: false };

  return { culture: cultureGenerique(brut), approx: true };
}
