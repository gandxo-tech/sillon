import type { Profil } from './features';

export interface Culture {
  id: string;
  nom: string;
  court: string;
  picto: string;
  teinte: string;
  famille: string;
  kc: number;
  partSaison: number;
  besoinJours: number;
  azoteDemande: number;
  azoteFixe: number;
  residus: number;
  couverture: number;
  facteurC: number;
  marge: number;
  toleranceSecheresse: number;
  facteurReserve: number;
  retour: number;
  perenne?: boolean;
  phMin: number;
  phMax: number;
}

export const CULTURES: Record<string, Culture> = {
  mais: {
    id: 'mais', nom: 'Maïs grain', court: 'Maïs', picto: '🌽', teinte: '#fff200', famille: 'Poacée',
    kc: 1.0, partSaison: 0.85, besoinJours: 130, azoteDemande: 175, azoteFixe: 0,
    residus: 5.2, couverture: 0.62, facteurC: 0.3, marge: 850, toleranceSecheresse: 0.34, facteurReserve: 1.0, retour: 2, phMin: 5.8, phMax: 7.6,
  },
  soja: {
    id: 'soja', nom: 'Soja', court: 'Soja', picto: '🫘', teinte: '#0018ff', famille: 'Fabacée',
    kc: 0.92, partSaison: 0.8, besoinJours: 125, azoteDemande: 35, azoteFixe: 105,
    residus: 3.1, couverture: 0.78, facteurC: 0.22, marge: 700, toleranceSecheresse: 0.45, facteurReserve: 1.0, retour: 3, phMin: 6.0, phMax: 7.5,
  },
  ble: {
    id: 'ble', nom: 'Blé tendre d’hiver', court: 'Blé', picto: '🌾', teinte: '#8b96f5', famille: 'Poacée',
    kc: 0.72, partSaison: 0.62, besoinJours: 110, azoteDemande: 115, azoteFixe: 0,
    residus: 3.6, couverture: 0.86, facteurC: 0.14, marge: 520, toleranceSecheresse: 0.55, facteurReserve: 1.15, retour: 3, phMin: 5.5, phMax: 7.8,
  },
  sorgho: {
    id: 'sorgho', nom: 'Sorgho grain', court: 'Sorgho', picto: '🌿', teinte: '#000b5c', famille: 'Poacée',
    kc: 0.82, partSaison: 0.78, besoinJours: 115, azoteDemande: 105, azoteFixe: 0,
    residus: 4.1, couverture: 0.6, facteurC: 0.26, marge: 560, toleranceSecheresse: 0.85, facteurReserve: 1.35, retour: 3, phMin: 5.5, phMax: 8.2,
  },
  couvert: {
    id: 'couvert', nom: 'Couvert seigle / vesce', court: 'Couvert', picto: '🌱', teinte: '#7f8ccc', famille: 'Mixte',
    kc: 0.35, partSaison: 0.35, besoinJours: 60, azoteDemande: 0, azoteFixe: 45,
    residus: 2.6, couverture: 1, facteurC: 0.05, marge: -140, toleranceSecheresse: 0.9, facteurReserve: 0.7, retour: 1, phMin: 4.8, phMax: 8.4,
  },
  luzerne: {
    id: 'luzerne', nom: 'Luzerne (3 ans)', court: 'Luzerne', picto: '🍀', teinte: '#3346ff', famille: 'Fabacée',
    kc: 0.95, partSaison: 1, besoinJours: 120, azoteDemande: 25, azoteFixe: 190,
    residus: 4.2, couverture: 0.95, facteurC: 0.08, marge: 600, toleranceSecheresse: 0.72, facteurReserve: 1.7, retour: 4, perenne: true, phMin: 6.2, phMax: 8.0,
  },
  pois: {
    id: 'pois', nom: 'Pois protéagineux', court: 'Pois', picto: '🫛', teinte: '#5a67c9', famille: 'Fabacée',
    kc: 0.78, partSaison: 0.6, besoinJours: 100, azoteDemande: 20, azoteFixe: 85,
    residus: 2.2, couverture: 0.72, facteurC: 0.18, marge: 480, toleranceSecheresse: 0.5, facteurReserve: 0.9, retour: 4, phMin: 6.0, phMax: 7.8,
  },
};

export interface DefinitionScenario {
  id: string;
  nom: string;
  accroche: string;
  role: string;
  cycle: string[];
  cultures?: Culture[];
  approx?: boolean;
}

export const SCENARIOS: DefinitionScenario[] = [
  {
    id: 'actuelle',
    nom: 'Rotation actuelle',
    accroche: 'Maïs — soja, alternance courte',
    role: 'Référence',
    cycle: ['mais', 'soja'],
  },
  {
    id: 'couvert',
    nom: 'Céréale + couvert',
    accroche: 'Maïs — soja — blé, avec couvert semé sous couvert',
    role: 'Structure du sol',
    cycle: ['mais', 'soja', 'ble', 'couvert'],
  },
  {
    id: 'resilient',
    nom: 'Diversification résiliente',
    accroche: 'Maïs — sorgho — soja, avec couvert',
    role: 'Résilience climatique',
    cycle: ['mais', 'sorgho', 'soja', 'couvert'],
  },
  {
    id: 'legumineuse',
    nom: 'Luzerne pivot',
    accroche: 'Trois ans de luzerne, puis maïs',
    role: 'Azote et racines profondes',
    cycle: ['luzerne', 'luzerne', 'luzerne', 'mais'],
  },
];

export interface Condition {
  id: 'actuel' | 'secheresse' | 'chaud' | 'projection';
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

export function construireContexte(p: Profil): ContexteRotation {
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
    irrigation: 0,
  };
}

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
  const rendement = bornes(1 - perte, 35, 100) / 100;

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
  if (!viable) scoreGlobal *= 0.65;

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

export interface ChoixCultures {
  actuelle: string;
  suivante: string;
}

export const CULTURES_LISTE = Object.values(CULTURES);

const SYNONYMES: Record<string, string> = {
  corn: 'mais',
  'mais grain': 'mais',
  'mais ensilage': 'mais',
  froment: 'ble',
  'ble dur': 'ble',
  'ble tendre': 'ble',
  orge: 'ble',
  avoine: 'ble',
  triticale: 'ble',
  mil: 'sorgho',
  'sorgho fourrager': 'sorgho',
  alfalfa: 'luzerne',
  feverole: 'pois',
  'pois fourrager': 'pois',
  'engrais vert': 'couvert',
  seigle: 'couvert',
  vesce: 'couvert',
  moutarde: 'couvert',
  phacelie: 'couvert',
  trefle: 'couvert',
  'ray grass': 'couvert',
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

function cultureGenerique(texte: string): Culture {
  const court = titreCase(texte).slice(0, 20) || 'Culture libre';
  return {
    id: `perso:${normaliser(texte).replace(/ /g, '-') || 'libre'}`,
    nom: court,
    court,
    picto: '🌱',
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
  };
}

export interface CultureResolue {
  culture: Culture;
  approx: boolean;
}

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
    return { culture: { ...CULTURES[viaSynonyme], court: titreCase(brut) }, approx: false };
  }

  const contenu = Object.values(CULTURES).find(
    (c) => cle.length >= 3 && (cle.includes(normaliser(c.court)) || normaliser(c.court).includes(cle)),
  );
  if (contenu) return { culture: { ...contenu, court: titreCase(brut) }, approx: false };

  return { culture: cultureGenerique(brut), approx: true };
}

export function scenarioUtilisateur(choix: ChoixCultures): DefinitionScenario {
  const a = resoudreCulture(choix.actuelle);
  const s = resoudreCulture(choix.suivante);
  const approx = a.approx || s.approx;
  const cultures = [a.culture, s.culture];
  return {
    id: 'utilisateur',
    nom: 'Votre rotation',
    accroche: `${a.culture.court} — ${s.culture.court}${approx ? ' (estimé)' : ''}`,
    role: 'Votre point de départ',
    cycle: cultures.map((c) => c.id),
    cultures,
    approx,
  };
}

export function construireScenarios(
  ctx: ContexteRotation,
  condition: Condition,
  choix?: ChoixCultures,
): ResultatRotation[] {
  const reference = choix ? scenarioUtilisateur(choix) : SCENARIOS[0];
  const alternatives = SCENARIOS.filter((s) => s.id !== 'actuelle');
  return [reference, ...alternatives].map((def) => calculerScenario(def, ctx, condition));
}
