/**
 * Moteur de décision de Sillon.
 *
 * Pas de catalogue de rotations toutes faites : l'espace de recherche est
 * construit à partir des cultures réellement saisies par l'utilisateur, puis
 * complété par la base seulement pour élargir les possibilités. Toutes les
 * successions de deux ou trois cultures sont essayées, dans les deux ordres.
 *
 *  1. l'espace = produits cartésiens des cultures du pool (2 et 3 ans) ;
 *  2. les rotations infaisables sont RETIRÉES, avec un code et une phrase ;
 *  3. la pondération suit les priorités déclarées, normalisées à 1 ;
 *  4. chaque candidat retenu garde sa trace : ce qu'il gagne, ce qu'il perd,
 *     et l'écart chiffré avec la rotation réellement saisie.
 *
 * Les calculs agronomiques (eau, érosion, matière organique) restent ceux de
 * `analyse/rotations.ts` : le moteur ne réimplémente pas RUSLE, il l'utilise.
 */

import type {
  Condition,
  ContexteRotation,
  DefinitionScenario,
  ResultatRotation,
} from '../analyse/rotations';
import { calculerScenario, resoudreCulture } from '../analyse/rotations';
import { CULTURES, CULTURES_LISTE, EURO_FCFA, PRIX_N_FCFA_KG } from '../data/cultures';
import type { Culture } from '../data/cultures';
import { arrondi, graineDepuis, nombre } from './des';

/* ------------------------------------------------------------------ */
/* Critères et pondération                                            */
/* ------------------------------------------------------------------ */

export type Critere = 'eau' | 'sol' | 'revenu' | 'securite' | 'intrants' | 'travail';

export const CRITERES: Critere[] = ['revenu', 'securite', 'eau', 'sol', 'intrants', 'travail'];

export const LIBELLES_CRITERE: Record<Critere, string> = {
  eau: 'l’eau',
  sol: 'la terre',
  revenu: 'l’argent',
  securite: 'la nourriture de la maison',
  intrants: 'les achats',
  travail: 'la main-d’œuvre',
};

/** Curseurs 0–100 fournis par l'utilisateur. */
export interface Priorites {
  revenu: number;
  securiteAlimentaire: number;
  sobrieteEau: number;
  autonomieIntrants: number;
  /** Curseur nécessaire à la formule du poids sol. */
  preservationSol: number;
  /** 100 = bras disponibles toute la saison, 0 = personne. */
  disponibiliteMainOeuvre: number;
}

export const PRIORITES_DEFAUT: Priorites = {
  revenu: 50,
  securiteAlimentaire: 50,
  sobrieteEau: 50,
  autonomieIntrants: 50,
  preservationSol: 50,
  disponibiliteMainOeuvre: 50,
};

export type Poids = Record<Critere, number>;

const normalise = (v: number): number => Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0)) / 100;

/**
 * Les poids du cahier des charges, normalisés à 1.
 * poids = 1 + k × curseur, avec le curseur ramené entre 0 et 1.
 */
export function calculerPoids(p: Priorites): Poids {
  const brut: Poids = {
    eau: 1 + 2 * normalise(p.sobrieteEau),
    revenu: 1 + 3 * normalise(p.revenu),
    securite: 1 + 3 * normalise(p.securiteAlimentaire),
    intrants: 1 + 2 * normalise(p.autonomieIntrants),
    sol: 1 + 1 * normalise(p.preservationSol),
    travail: 1 + 1 * normalise(100 - p.disponibiliteMainOeuvre),
  };
  const somme = CRITERES.reduce((s, c) => s + brut[c], 0);
  const sortie = {} as Poids;
  for (const c of CRITERES) sortie[c] = brut[c] / somme;
  return sortie;
}

/* ------------------------------------------------------------------ */
/* Contraintes de l'exploitation                                      */
/* ------------------------------------------------------------------ */

export type NiveauCapital = 'faible' | 'moyen' | 'eleve';

/** Budget d'intrants déclaré, FCFA par hectare et par an. */
export const CAPITAL_FCFA: Record<NiveauCapital, number> = {
  faible: 100_000,
  moyen: 250_000,
  eleve: 500_000,
};

export type CodeRejet = 'CYCLE' | 'PH' | 'EROSION' | 'RETOUR' | 'MARCHE' | 'EAU' | 'CAPITAL';

export interface Rejet {
  id: string;
  code: CodeRejet;
  phrase: string;
}

/** Rejet interne : la cause sert à ne pas répéter dix fois le même motif. */
type RejetInterne = { code: CodeRejet; phrase: string; cause: string };

export type FamilleRotation =
  | 'cerealiere'
  | 'legumineuse'
  | 'couvert'
  | 'tubercule'
  | 'fourragere'
  | 'mixte';

export interface EntreeMoteur {
  ctx: ContexteRotation;
  condition: Condition;
  priorites: Priorites;
  cheptel: boolean;
  capital: NiveauCapital;
  /** Les trois dernières cultures, de la plus ancienne à la plus récente. */
  historique: string[];
  /** Cultures réellement saisies : la référence se construit avec elles. */
  actuelle: Culture[];
  approx?: boolean;
  lat: number;
  lon: number;
}

/* ------------------------------------------------------------------ */
/* Références de calcul (constantes assumées, jamais des mesures)      */
/* ------------------------------------------------------------------ */

/** Marge nette qui vaut 100 points de revenu. */
const MARGE_REF_FCFA = 560_000;
/** Récolte qui vaut 100 points de sécurité alimentaire. */
const CALORIES_REF_MCAL = 6_000;
/** Jours de travail par hectare qui vident le score de travail. */
const TRAVAIL_REF_JOURS = 120;
/** Part de la fixation d'azote non déjà créditée dans la marge de base. */
const PART_PRIME_AZOTE = 0.45;
/** Nombre maximal de cultures dans le pool de recherche. */
const TAILLE_POOL = 8;

/* ------------------------------------------------------------------ */
/* Espace de recherche : les cultures de l'utilisateur d'abord         */
/* ------------------------------------------------------------------ */

export interface Succession {
  id: string;
  nom: string;
  cultures: Culture[];
  famille: FamilleRotation;
  pourquoi: string;
  besoinCheptel: boolean;
}

function familleDe(cultures: Culture[]): FamilleRotation {
  const types = cultures.map((c) => c.typeCulture);
  if (types.every((t) => t === 'couvert')) return 'couvert';
  if (types.every((t) => t === 'legumineuse')) return 'legumineuse';
  if (types.some((t) => t === 'tubercule')) return 'tubercule';
  if (types.some((t) => t === 'fourragere')) return 'fourragere';
  if (types.some((t) => t === 'legumineuse') && types.some((t) => t === 'cereale')) return 'mixte';
  return 'cerealiere';
}

function pourquoiDe(cultures: Culture[]): string {
  const morceaux: string[] = [];
  for (let i = 0; i < cultures.length - 1; i += 1) {
    const avant = cultures[i];
    const apres = cultures[i + 1];
    if (avant.typeCulture === 'legumineuse' && apres.typeCulture !== 'legumineuse' && apres.typeCulture !== 'couvert') {
      morceaux.push(`La légumineuse passe avant la céréale : elle lui laisse de l’engrais de la nature.`);
      break;
    }
  }
  if (cultures.some((c) => c.typeCulture === 'legumineuse') && !morceaux.length) {
    morceaux.push('La légumineuse rend de l’engrais de la nature au sol.');
  }
  if (cultures.some((c) => c.typeCulture === 'couvert')) {
    morceaux.push('La couverture garde la terre en place entre deux récoltes.');
  }
  if (!morceaux.length) {
    morceaux.push('Deux cultures différentes se relaient : les insectes nuisibles ont moins de repères.');
  }
  return morceaux.slice(0, 2).join(' ');
}

const succession = (cultures: Culture[]): Succession => ({
  id: `s_${cultures.map((c) => c.id).join('_')}`,
  nom: cultures.map((c) => c.court).join(' puis '),
  cultures,
  famille: familleDe(cultures),
  pourquoi: pourquoiDe(cultures),
  besoinCheptel: cultures.some((c) => c.marche === 'eleveur'),
});

/** Une répétition immédiate n'est admise que pour une culture pérenne. */
function valide(cultures: Culture[]): boolean {
  for (let i = 0; i < cultures.length - 1; i += 1) {
    if (cultures[i].id === cultures[i + 1].id && !cultures[i].perenne) return false;
  }
  return new Set(cultures.map((c) => c.id)).size >= 2;
}

/**
 * Pool de recherche.
 *
 * Par défaut, il ne contient QUE les cultures de l'exploitant : on ne propose
 * jamais une culture qu'il ne possède pas. La base de 23 cultures n'est
 * ouverte qu'avec `elargir = true`, en dernier recours (voir `chercherRotations`),
 * et le rapport l'annonce alors explicitement.
 *
 * Une culture inconnue de la base arrive ici avec des coefficients génériques
 * et participe normalement à la recherche.
 */
export type ZoneClimat = 'tropical' | 'subtropical' | 'temperate';

/** Zone agro-climatique déduite de la latitude. */
export function zoneDeLat(lat: number): ZoneClimat {
  const a = Math.abs(lat);
  if (a < 23.5) return 'tropical';
  if (a < 35) return 'subtropical';
  return 'temperate';
}

/** Une culture convient-elle à cette zone ? Absence de `zones` = universelle. */
export function convientZone(c: Culture, zone: ZoneClimat): boolean {
  if (!c.zones || c.zones.length === 0) return true;
  return c.zones.includes(zone);
}

export function completerPool(saisies: Culture[], elargir = false, lat?: number): Culture[] {
  const pool: Culture[] = [];
  const ajouter = (c: Culture | undefined) => {
    if (!c) return;
    if (pool.length >= TAILLE_POOL) return;
    if (pool.some((p) => p.id === c.id)) return;
    pool.push(c);
  };
  for (const c of saisies) ajouter(c);
  if (!elargir) return pool;

  const zone = lat === undefined ? null : zoneDeLat(lat);
  const convient = (c: Culture): boolean => (zone === null ? true : convientZone(c, zone));

  const types: Culture['typeCulture'][] = ['cereale', 'legumineuse', 'tubercule', 'couvert', 'fourragere'];
  for (const t of types) {
    if (pool.some((c) => c.typeCulture === t)) continue;
    ajouter(CULTURES_LISTE.find((c) => c.typeCulture === t && convient(c)));
  }
  for (const c of CULTURES_LISTE) {
    if (!convient(c)) continue;
    ajouter(c);
  }
  return pool;
}

/**
 * Toutes les successions plausibles de deux ou trois cultures du pool,
 * dans l'ordre. C'est ici que se joue la recherche, pas dans un catalogue.
 */
export function construireEspace(saisies: Culture[], saisonJours?: number, elargir = false, lat?: number): Succession[] {
  const pool = completerPool(saisies, elargir, lat);
  const out: Succession[] = [];
  const vus = new Set<string>();

  const ajouter = (cultures: Culture[]) => {
    if (saisonJours) {
      const tropLongue = cultures.find((c) => c.besoinJours > saisonJours + 15);
      if (tropLongue) return;
    }
    if (!valide(cultures)) return;
    const cle = cultures.map((c) => c.id).join('>');
    if (vus.has(cle)) return;
    vus.add(cle);
    out.push(succession(cultures));
  };

  for (const a of pool) {
    for (const b of pool) {
      if (a.id === b.id) continue;
      ajouter([a, b]);
    }
  }

  for (const a of pool) {
    for (const b of pool) {
      for (const c of pool) {
        ajouter([a, b, c]);
      }
    }
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Évaluation d'un candidat                                           */
/* ------------------------------------------------------------------ */

export interface Metriques {
  base: ResultatRotation;
  sousScores: Record<Critere, number>;
  score: number;
  revenuNetFcfa: number;
  coutIntrantFcfaHa: number;
  travailJoursHa: number;
  caloriesMcalHa: number;
  azoteFixeMoyen: number;
  primeLegumineusePts: number;
  primeLegumineuseFcfa: number;
  /** Points d'autonomie gagnés quand la légumineuse précède la céréale. */
  primeOrdrePts: number;
  partAutoconsommation: number;
}

const bornes = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const moy = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function evaluer(
  def: DefinitionScenario,
  cultures: Culture[],
  e: EntreeMoteur,
  poids: Poids,
): Metriques {
  const base = calculerScenario(def, e.ctx, e.condition);
  const n = cultures.length || 1;

  const azoteFixeMoyen = moy(cultures.map((c) => c.azoteFixe));
  const primeLegumineusePts = azoteFixeMoyen > 0 ? 8 + 6 * Math.min(1, azoteFixeMoyen / 190) : 0;
  const primeLegumineuseFcfa = azoteFixeMoyen * PRIX_N_FCFA_KG * PART_PRIME_AZOTE;

  /* L'ordre compte : l'engrais de la nature laissé par une légumineuse profite
     à la culture qui suit. Le modèle hydrique, lui, reste indifférent à l'ordre. */
  let primeOrdrePts = 0;
  for (let i = 0; i < cultures.length - 1; i += 1) {
    const avant = cultures[i];
    const apres = cultures[i + 1];
    if (avant.typeCulture === 'legumineuse' && apres.typeCulture !== 'legumineuse' && apres.typeCulture !== 'couvert') {
      primeOrdrePts += 4;
    }
  }

  /* Revenu : la marge existante, lue en FCFA, plus ce que la légumineuse
     économise, moins ce que la terre perdue coûte en rendement. */
  const produitFcfa =
    cultures.reduce(
      (s, c) => s + (c.marge > 0 ? c.marge * base.rendement : c.marge) * EURO_FCFA,
      0,
    ) / n;
  const coutAzoteFcfa = base.azote * PRIX_N_FCFA_KG;
  const perteErosive = Math.min(0.3, 0.035 * base.erosion) * produitFcfa;
  const revenuNetFcfa =
    produitFcfa - coutAzoteFcfa + primeLegumineuseFcfa - perteErosive - e.ctx.irrigation * 0.4 * EURO_FCFA;

  const travailJoursHa = moy(cultures.map((c) => c.travailJoursHa));
  const coutIntrantFcfaHa = cultures.reduce((s, c) => s + c.coutIntrantFcfaHa, 0);
  const caloriesMcalHa = moy(cultures.map((c) => c.caloriesMcalHa));
  const partAutoconsommation =
    cultures.filter((c) => c.marche === 'autoconsommation').length / n;

  const sousScores: Record<Critere, number> = {
    eau: base.scores.eau,
    sol: base.scores.sol,
    revenu: bornes((100 * revenuNetFcfa) / MARGE_REF_FCFA),
    securite: bornes(
      0.6 * (100 * Math.min(1.4, caloriesMcalHa / CALORIES_REF_MCAL)) +
        0.4 * (100 * partAutoconsommation) -
        25 * base.rupture,
    ),
    // Autonomie : la part du revenu annuel que les achats d'intrants mangent.
    intrants: bornes(
      100 *
        (1 - Math.min(1, coutIntrantFcfaHa / Math.max(1, cultures.length) / Math.max(1, revenuNetFcfa))) +
        primeLegumineusePts +
        primeOrdrePts,
    ),
    travail: bornes(100 - (100 * travailJoursHa) / TRAVAIL_REF_JOURS),
  };

  let score = 0;
  for (const c of CRITERES) score += poids[c] * sousScores[c];
  score = bornes(score);

  // La marge publiée est en FCFA par hectare : c'est la monnaie de la décision.
  const resultat: ResultatRotation = {
    ...base,
    marge: revenuNetFcfa,
    margeBasse: revenuNetFcfa * (1 - (0.12 + base.stress * 0.3)),
    margeHaute: revenuNetFcfa * (1 + 0.12 + base.stress * 0.3),
  };

  return {
    base: resultat,
    sousScores,
    score,
    revenuNetFcfa,
    coutIntrantFcfaHa,
    travailJoursHa,
    caloriesMcalHa,
    azoteFixeMoyen,
    primeLegumineusePts,
    primeLegumineuseFcfa,
    primeOrdrePts,
    partAutoconsommation,
  };
}

/* ------------------------------------------------------------------ */
/* Filtres durs                                                       */
/* ------------------------------------------------------------------ */

const nomDe = (c: Culture) => c.court.toLowerCase();

/**
 * Cycle : une culture doit tenir dans une saison. Pour une séquence semée
 * la même saison (céréale + couverture), c'est le cumul qui compte.
 */
function excesCycle(s: Succession, e: EntreeMoteur, relaxe = false): Omit<RejetInterne, 'code'> | null {
  const marge = relaxe ? 45 : 15;
  const limite = e.ctx.saisonJours + marge;
  const tropLongue = s.cultures.find((c) => c.besoinJours > limite);
  if (tropLongue) {
    return {
      cause: tropLongue.id,
      phrase: `${s.nom} écartée : ${nomDe(tropLongue)} demande ${tropLongue.besoinJours} jours, votre saison en fait ${Math.round(e.ctx.saisonJours)}.`,
    };
  }
  const couvert = s.cultures.find((c) => c.typeCulture === 'couvert');
  if (couvert) {
    const céréale = s.cultures.find((c) => c.typeCulture === 'cereale');
    const cumul = (céréale?.besoinJours ?? 0) + couvert.besoinJours;
    if (céréale && cumul > limite) {
      return {
        cause: 'cumul',
        phrase: `${s.nom} écartée : la céréale et sa couverture se chevauchent et demandent ${cumul} jours pour ${Math.round(e.ctx.saisonJours)}.`,
      };
    }
  }
  return null;
}

/** Retour : une culture revenue trop tôt ne revient pas dans la candidature. */
function excesRetour(
  s: Succession,
  historiqueIds: string[],
  relaxe = false,
): Omit<RejetInterne, 'code'> | null {
  /* Répétition à l'intérieur de la succession : une culture qui revient trop
     tôt annule l'effet de la rotation, que l'historique soit connu ou non. */
  for (let i = 0; i < s.cultures.length; i += 1) {
    const culture = s.cultures[i];
    if (culture.perenne) continue;
    for (let j = i + 1; j < s.cultures.length; j += 1) {
      if (s.cultures[j].id !== culture.id) continue;
      const intervalle = j - i;
      if (intervalle < culture.retour) {
        return {
          cause: culture.id,
          phrase: `${s.nom} écartée : ${nomDe(culture)} reviendrait ${intervalle} ans plus tard, il lui faut ${culture.retour} ans.`,
        };
      }
    }
  }

  const n = historiqueIds.length;
  // En mode relâché, on garde l'avertissement mais on ne bloque pas sur
  // l'historique : le rapport signalera le retour trop rapproché.
  if (relaxe) return null;
  if (!n) return null;
  for (let position = 0; position < s.cultures.length; position += 1) {
    const culture = s.cultures[position];
    if (culture.perenne) continue;
    for (let k = 0; k < n; k += 1) {
      if (historiqueIds[k] !== culture.id) continue;
      const anciennete = n - k;
      const ecart = anciennete + position;
      if (ecart <= culture.retour) {
        return {
          cause: culture.id,
          phrase: `${s.nom} écartée : ${nomDe(culture)} a poussé il y a ${anciennete} an${anciennete > 1 ? 's' : ''}, il faut attendre ${culture.retour} ans avant d’y revenir.`,
        };
      }
    }
  }
  return null;
}

function verifier(
  s: Succession,
  m: Metriques,
  e: EntreeMoteur,
  historiqueIds: string[],
  relaxe = false,
): RejetInterne | null {
  const cycle = excesCycle(s, e, relaxe);
  if (cycle) return { code: 'CYCLE', ...cycle };

  const retour = excesRetour(s, historiqueIds, relaxe);
  if (retour) return { code: 'RETOUR', ...retour };

  const margePh = relaxe ? 0.5 : 0;
  const horsPh = s.cultures.find((c) => e.ctx.ph < c.phMin - margePh || e.ctx.ph > c.phMax + margePh);
  if (horsPh) {
    return {
      code: 'PH',
      cause: horsPh.id,
      phrase: `${s.nom} écartée : votre terre est à pH ${arrondi(e.ctx.ph, 1)}, ${nomDe(horsPh)} demande ${horsPh.phMin} à ${horsPh.phMax}.`,
    };
  }

  // En mode relâché, l'érosion ne bloque plus : le rapport la signalera.
  if (!relaxe && e.ctx.pente !== null && e.ctx.pente > 8 && m.base.erosion > 7) {
    return {
      code: 'EROSION',
      cause: 'pente',
      phrase: `${s.nom} écartée : sur cette pente, elle laisserait partir ${arrondi(m.base.erosion, 1)} tonnes de terre par hectare et par an.`,
    };
  }

  if (!relaxe && !e.cheptel) {
    const versCheptel = s.cultures.find((c) => c.marche === 'eleveur');
    if (versCheptel) {
      return {
        code: 'MARCHE',
        cause: versCheptel.id,
        phrase: `${s.nom} écartée : ${nomDe(versCheptel)} a besoin d’un cheptel pour s’écouler, vous n’en avez pas déclaré.`,
      };
    }
  }

  // Le budget est annuel : on le compare au coût moyen par année de la
  // succession, pas au total des années cumulées.
  const budget = CAPITAL_FCFA[e.capital];
  const coutAnnuel = m.coutIntrantFcfaHa / s.cultures.length;
  const budgetEffectif = relaxe ? budget * 1.3 : budget;
  if (coutAnnuel > budgetEffectif) {
    return {
      code: 'CAPITAL',
      cause: 'budget',
      phrase: `${s.nom} écartée : ${Math.round(coutAnnuel / 1000) * 1000} FCFA d’intrants par hectare et par an, votre budget est de ${Math.round(budget / 1000) * 1000} FCFA.`,
    };
  }

  const seuilStress = relaxe ? 0.75 : 0.55;
  if (m.base.stress > seuilStress) {
    return {
      code: 'EAU',
      cause: 'eau',
      phrase: `${s.nom} écartée : elle manquerait d’eau à ${Math.round(m.base.stress * 100)} %, au-delà de 55 % on ne tente pas.`,
    };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Sortie                                                             */
/* ------------------------------------------------------------------ */

export interface Candidat {
  id: string;
  nom: string;
  suite: string[];
  cultures: Culture[];
  famille: FamilleRotation;
  pourquoi: string;
  rang: number;
  score: number;
  sousScores: Record<Critere, number>;
  metriques: Metriques;
  resultat: ResultatRotation;
  gagneSur: Critere[];
  perdSur: Critere[];
  ecarts: Record<Critere, number>;
  alertes: string[];
}

export interface VerifStabilite {
  pluiePct: number;
  premier: number;
  troisieme: number;
  ecart: number;
}

/** La meilleure option quand la saison tourne mal, pour le bloc 5 du rapport. */
export interface Repli {
  pluiePct: number;
  id: string;
  nom: string;
  score: number;
  deficitMm: number;
}

export interface SortieMoteur {
  reference: Candidat;
  classement: Candidat[];
  meilleure: Candidat;
  rejets: Rejet[];
  poids: Poids;
  stabilite: 'solide' | 'fragile';
  phraseStabilite: string | null;
  verifications: VerifStabilite[];
  replis: Repli[];
  graine: number;
  nombreCandidats: number;
  /** Vrai si la base a dû être ouverte faute de succession retenue avec vos cultures. */
  poolElargi: boolean;
  /** Vrai si même la base complète n'a rien donné et qu'il a fallu relâcher les seuils. */
  poolRelaxe: boolean;
}

const definitionDe = (s: Succession): DefinitionScenario => ({
  id: s.id,
  nom: s.nom,
  accroche: s.cultures.map((c) => c.court).join(' puis '),
  role: s.famille,
  cycle: s.cultures.map((c) => c.id),
  cultures: s.cultures,
});

function alertesDe(m: Metriques, e: EntreeMoteur, s: Succession): string[] {
  const alertes: string[] = [];
  if (m.base.stress > 0.32) {
    alertes.push(
      `Il manquerait ${Math.round(m.base.deficit)} mm d’eau sur la saison : c’est un risque à couvrir, pas une impossibilité.`,
    );
  }
  const coutAnnuel = m.coutIntrantFcfaHa / Math.max(1, s.cultures.length);
  if (coutAnnuel > 0.7 * CAPITAL_FCFA[e.capital]) {
    alertes.push(
      `Les intrants mangeraient ${Math.round((100 * coutAnnuel) / CAPITAL_FCFA[e.capital])} % de votre budget annuel.`,
    );
  }
  if (m.base.rupture > 0.5) {
    alertes.push('Une culture revient souvent : surveillez les mauvaises herbes et les insectes.');
  }
  return alertes;
}

function ecartsAvec(reference: Metriques, m: Metriques): Record<Critere, number> {
  const ecarts = {} as Record<Critere, number>;
  for (const c of CRITERES) ecarts[c] = arrondi(m.sousScores[c] - reference.sousScores[c], 1);
  return ecarts;
}

/** Candidat construit depuis l'actuelle : jamais codé en dur, jamais filtré. */
function candidatReference(cultures: Culture[], e: EntreeMoteur, poids: Poids): Candidat {
  const def: DefinitionScenario = {
    id: 'utilisateur',
    nom: 'Votre rotation',
    accroche: cultures.map((c) => c.court).join(' puis '),
    role: 'Votre point de départ',
    cycle: cultures.map((c) => c.id),
    cultures,
    approx: e.approx,
  };
  const m = evaluer(def, cultures, e, poids);
  return {
    id: 'utilisateur',
    nom: 'Votre rotation',
    suite: cultures.map((c) => c.id),
    cultures,
    famille: familleDe(cultures),
    pourquoi: 'Ce que vous faites aujourd’hui, avec vos cultures.',
    rang: 0,
    score: m.score,
    sousScores: m.sousScores,
    metriques: m,
    resultat: m.base,
    gagneSur: [],
    perdSur: [],
    ecarts: ecartsAvec(m, m),
    alertes: alertesDe(m, e, succession(cultures)),
  };
}

/** Le classement complet, recalculé pour une condition donnée. */
function classer(
  espace: Succession[],
  e: EntreeMoteur,
  poids: Poids,
  condition: Condition,
  historiqueIds: string[],
  relaxe = false,
): {
  retenus: { s: Succession; m: Metriques }[];
  rejets: { s: Succession; rejet: RejetInterne; score: number }[];
} {
  const e2: EntreeMoteur = { ...e, condition };
  const retenus: { s: Succession; m: Metriques }[] = [];
  const rejets: { s: Succession; rejet: RejetInterne; score: number }[] = [];

  for (const s of espace) {
    const m = evaluer(definitionDe(s), s.cultures, e2, poids);
    const rejet = verifier(s, m, e2, historiqueIds, relaxe);
    if (rejet) rejets.push({ s, rejet, score: m.score });
    else retenus.push({ s, m });
  }

  retenus.sort((x, y) => y.m.score - x.m.score || (x.s.id < y.s.id ? -1 : 1));
  return { retenus, rejets };
}

export function chercherRotations(e: EntreeMoteur): SortieMoteur {
  const poids = calculerPoids(e.priorites);
  const historiqueIds = e.historique
    .map((t) => (t ?? '').trim())
    .filter(Boolean)
    .map((t) => resoudreCulture(t).culture.id);

  const graine = graineDepuis(e.lat, e.lon, e.actuelle.map((c) => c.id).join(','));

  const reference = candidatReference(e.actuelle, e, poids);

  /* Première passe : uniquement les cultures de l'exploitant. La base ne sert
     qu'en dernier recours, si rien de ce qu'il cultive ne passe les filtres.
     Il voit alors la mention « recherche élargie » dans le bloc technique. */
  let espace = construireEspace(e.actuelle, e.ctx.saisonJours, false, e.lat);
  let base = classer(espace, e, poids, e.condition, historiqueIds);
  let poolElargi = false;
  let poolRelaxe = false;
  if (!base.retenus.length) {
    espace = construireEspace(e.actuelle, e.ctx.saisonJours, true, e.lat);
    base = classer(espace, e, poids, e.condition, historiqueIds);
    poolElargi = true;
  }
  /* Dernier recours : si rien ne passe même avec la base complète, on relâche
     les seuils les plus stricts (érosion, cycle, pH, eau, budget) pour rendre
     au moins quelques options actionnables au lieu d'un mur. Les contraintes
     agronomiques dures (retour, marché/cheptel) restent appliquées. */
  if (!base.retenus.length) {
    base = classer(espace, e, poids, e.condition, historiqueIds, true);
    poolRelaxe = true;
  }

  const retenus: Candidat[] = base.retenus.slice(0, 8).map((r, i) => {
    const { s, m } = r;
    const ecarts = ecartsAvec(reference.metriques, m);
    return {
      id: s.id,
      nom: s.nom,
      suite: s.cultures.map((c) => c.id),
      cultures: s.cultures,
      famille: s.famille,
      pourquoi: s.pourquoi,
      rang: i + 1,
      score: arrondi(m.score, 1),
      sousScores: m.sousScores,
      metriques: { ...m, score: arrondi(m.score, 1) },
      resultat: m.base,
      gagneSur: CRITERES.filter((c) => ecarts[c] >= 3),
      perdSur: CRITERES.filter((c) => ecarts[c] <= -3),
      ecarts,
      alertes: alertesDe(m, e, s),
    } satisfies Candidat;
  });

  /* Rejets affichés : les plus proches de l'actuelle, mais chaque motif
     doit être représenté au moins une fois. Sans cela, un motif fréquent
     masquerait la raison qui explique justement l'absence d'une culture.
     Pour le motif « marché », une succession qui exige un cheptel passe devant. */
  const proches = base.rejets
    .slice()
    .sort((x, y) => Math.abs(x.score - reference.score) - Math.abs(y.score - reference.score));
  const choisis: typeof proches = [];
  const causesVues = new Set<string>();
  for (const code of ['CYCLE', 'RETOUR', 'PH', 'EROSION', 'MARCHE', 'CAPITAL', 'EAU'] as CodeRejet[]) {
    const duCode = proches.filter((r) => r.rejet.code === code);
    if (!duCode.length) continue;
    const prefere =
      code === 'MARCHE'
        ? duCode.slice().sort((x, y) => Number(y.s.besoinCheptel) - Number(x.s.besoinCheptel))[0]
        : duCode[0];
    choisis.push(prefere);
    causesVues.add(`${code}:${prefere.rejet.cause}`);
  }
  for (const r of proches) {
    if (choisis.length >= 8) break;
    const cle = `${r.rejet.code}:${r.rejet.cause}`;
    if (causesVues.has(cle)) continue;
    causesVues.add(cle);
    choisis.push(r);
  }
  const rejets: Rejet[] = choisis
    .sort((x, y) => Math.abs(x.score - reference.score) - Math.abs(y.score - reference.score))
    .slice(0, 8)
    .map((r) => ({ id: r.s.id, code: r.rejet.code, phrase: r.rejet.phrase }));

  /* Test de stabilité : le classement tient-il sous −10 % et −20 % de pluie ? */
  const verifications: VerifStabilite[] = [];
  const replis: Repli[] = [];
  for (const pluiePct of [-10, -20]) {
    const variante = classer(
      espace,
      e,
      poids,
      { ...e.condition, pluiePct: e.condition.pluiePct + pluiePct, tempDelta: e.condition.tempDelta },
      historiqueIds,
    );
    if (!variante.retenus.length) continue;
    const premier = variante.retenus[0].m.score;
    const troisieme = variante.retenus[Math.min(2, variante.retenus.length - 1)].m.score;
    const pluie = e.condition.pluiePct + pluiePct;
    verifications.push({
      pluiePct: pluie,
      premier: arrondi(premier, 1),
      troisieme: arrondi(troisieme, 1),
      ecart: arrondi(premier - troisieme, 1),
    });
    replis.push({
      pluiePct: pluie,
      id: variante.retenus[0].s.id,
      nom: variante.retenus[0].s.nom,
      score: arrondi(premier, 1),
      deficitMm: arrondi(variante.retenus[0].m.base.deficit),
    });
  }

  const ecartMin = verifications.length ? Math.min(...verifications.map((v) => v.ecart)) : Infinity;
  const fragile = verifications.length > 0 && ecartMin < 4;
  const phraseStabilite = fragile
    ? `Les trois premières options tiennent dans ${nombre(ecartMin, 1)} point${ecartMin >= 2 ? 's' : ''} : c’est un arbitrage, pas un optimum.`
    : null;

  return {
    reference,
    classement: retenus,
    meilleure: retenus[0] ?? { ...reference, rang: 1 },
    rejets,
    poids,
    stabilite: fragile ? 'fragile' : 'solide',
    phraseStabilite,
    verifications,
    replis,
    graine,
    nombreCandidats: espace.length,
    poolElargi,
    poolRelaxe,
  };
}
