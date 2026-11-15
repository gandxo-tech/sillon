/**
 * Explication en français simple.
 *
 * Transforme un verdict chiffré en trois temps, toujours dans cet ordre :
 *   1. le constat sur la zone ;
 *   2. le lien avec la rotation proposée ;
 *   3. la conséquence pour l'exploitant.
 *
 * Règles tenues ici, vérifiées par `__tests__/explication.test.ts` :
 *  - une phrase = une idée, 20 mots maximum, deuxième personne du pluriel ;
 *  - un seul chiffre par explication, toujours comparé à la rotation actuelle ;
 *  - l'argent est en FCFA par hectare, les dates sont des mois ;
 *  - aucun mot du lexique interdit (voir README, section « Langage ») ;
 *  - un verdict favorable finit toujours par une réserve concrète ;
 *  - aucun archétype cité s'il n'est pas déclenché, deux au maximum ;
 *  - choix déterministe : hash(parcelle, emplacement) % 6, sans répétition
 *    d'une même formulation dans un rapport.
 */

import type { Profil } from '../analyse/features';
import { hash32, nombre } from '../moteur/des';

/* ------------------------------------------------------------------ */
/* Archétypes de zone                                                 */
/* ------------------------------------------------------------------ */

export type Archetype = 'sec' | 'pluies_fortes' | 'pente' | 'terre_lourde' | 'terre_sableuse' | 'plaine_basse';

export type NiveauVerdict = 'oui' | 'conditionnel' | 'non';

/** Mesures déjà chargées pour la parcelle. Rien n'est saisi à la main ici. */
export interface Mesures {
  /** Clé de déterminisme : « lat,lon » à cinq décimales. */
  parcelle: string;
  pluieAnnuelleMm: number;
  pluieSaisonMm: number;
  saisonJours: number;
  /** Somme annuelle de la soif de l'air, en mm. */
  soifAirAnnuelleMm: number;
  argilePct: number;
  sablePct: number;
  pentePct: number | null;
  altitudeM: number | null;
  drainage: string;
}

export interface Zone {
  parcelle: string;
  /** Archétypes déclenchés, du plus déterminant au moins déterminant. */
  archetypes: Archetype[];
  mesures: Mesures;
}

export interface Faits {
  /** Rotation proposée, en langage courant : « Niébé puis Maïs ». */
  rotation: string;
  /** Rotation réellement pratiquée : l'étalon de comparaison. */
  actuelle: string;
  ecartRevenuFcfa: number;
  manqueEauMm: number;
  moisSemis: string;
  moisRecolte: string;
}

export interface Explication {
  texte: string;
  /** Archétypes réellement cités (0 à 2). */
  archetypes: Archetype[];
  /** Faits chiffrés qui justifient la phrase, avec leur seuil. */
  faits: string[];
  /** Calcul d'origine, pour remonter de la phrase au chiffre. */
  source: string;
}

/* ------------------------------------------------------------------ */
/* Seuils, explicites et documentés                                   */
/* ------------------------------------------------------------------ */

export const SEUILS: Record<Archetype, { seuil: string; marge: (m: Mesures) => number }> = {
  sec: {
    seuil: 'pluie annuelle divisée par la soif de l’air < 0,50',
    // Indice d'aridité : même définition que `climat.aridite` (features.ts).
    marge: (m) =>
      m.soifAirAnnuelleMm > 0 && m.pluieAnnuelleMm / m.soifAirAnnuelleMm < 0.5
        ? (0.5 - m.pluieAnnuelleMm / m.soifAirAnnuelleMm) / 0.5
        : 0,
  },
  pluies_fortes: {
    seuil: '6 mm de pluie ou plus par jour de saison',
    marge: (m) => {
      const intensite = m.saisonJours > 0 ? m.pluieSaisonMm / m.saisonJours : 0;
      return intensite >= 6 ? (intensite - 6) / 6 : 0;
    },
  },
  pente: {
    seuil: 'pente ≥ 2 %',
    marge: (m) => (m.pentePct === null ? 0 : m.pentePct >= 2 ? (m.pentePct - 2) / 8 : 0),
  },
  terre_lourde: {
    seuil: 'argile ≥ 35 % sur 0–30 cm',
    marge: (m) => (m.argilePct >= 35 ? (m.argilePct - 35) / 20 : 0),
  },
  terre_sableuse: {
    seuil: 'sable ≥ 70 % sur 0–30 cm',
    marge: (m) => (m.sablePct >= 70 ? (m.sablePct - 70) / 20 : 0),
  },
  plaine_basse: {
    seuil: 'altitude ≤ 350 m et pente < 2 %',
    marge: (m) =>
      m.altitudeM !== null && m.pentePct !== null && m.altitudeM <= 350 && m.pentePct < 2
        ? (350 - m.altitudeM) / 350
        : 0,
  },
};

const ORDRE: Archetype[] = [
  'sec',
  'pluies_fortes',
  'pente',
  'terre_lourde',
  'terre_sableuse',
  'plaine_basse',
];

export const NOMS_ARCHETYPE: Record<Archetype, string> = {
  sec: 'manque d’eau',
  pluies_fortes: 'pluies fortes',
  pente: 'pente',
  terre_lourde: 'terre lourde',
  terre_sableuse: 'terre sableuse',
  plaine_basse: 'plaine basse',
};

/** Déclare les archétypes à partir des seules mesures déjà chargées. */
export function archetypesDe(m: Mesures): Archetype[] {
  return ORDRE.map((a) => ({ a, marge: SEUILS[a].marge(m) }))
    .filter((x) => x.marge > 0)
    .sort((x, y) => y.marge - x.marge || ORDRE.indexOf(x.a) - ORDRE.indexOf(y.a))
    .map((x) => x.a);
}

export function zoneDepuis(m: Mesures): Zone {
  return { parcelle: m.parcelle, archetypes: archetypesDe(m), mesures: m };
}

/** Lit les mesures d'un profil déjà construit : aucune requête supplémentaire. */
export function mesuresDe(profil: Profil): Mesures {
  return {
    parcelle: `${profil.lieu.lat.toFixed(5)},${profil.lieu.lon.toFixed(5)}`,
    pluieAnnuelleMm: profil.climat.pluieAnnuelle,
    pluieSaisonMm: profil.climat.pluieSaison,
    saisonJours: profil.saison.duree,
    soifAirAnnuelleMm: profil.climat.et0Annuel,
    argilePct: profil.sol.argile,
    sablePct: profil.sol.sable,
    pentePct: profil.relief.pente,
    altitudeM: profil.relief.altitude,
    drainage: profil.sol.drainage,
  };
}

/* ------------------------------------------------------------------ */
/* Fait chiffré attaché à chaque archétype                            */
/* ------------------------------------------------------------------ */

const arrondi2 = (v: number): string =>
  Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'non disponible';

export function faitDe(a: Archetype, m: Mesures): string {
  switch (a) {
    case 'sec':
      return `pluie ${nombre(m.pluieAnnuelleMm)} mm pour une soif de l’air de ${nombre(m.soifAirAnnuelleMm)} mm, rapport ${arrondi2(
        m.soifAirAnnuelleMm > 0 ? m.pluieAnnuelleMm / m.soifAirAnnuelleMm : NaN,
      )} (seuil 0,50)`;
    case 'pluies_fortes':
      return `${arrondi2(m.saisonJours > 0 ? m.pluieSaisonMm / m.saisonJours : NaN)} mm par jour de saison sur ${
        m.saisonJours
      } jours (seuil 6)`;
    case 'pente':
      return `pente ${arrondi2(m.pentePct ?? NaN)} % (seuil 2)`;
    case 'terre_lourde':
      return `argile ${arrondi2(m.argilePct)} % sur 0–30 cm (seuil 35)`;
    case 'terre_sableuse':
      return `sable ${arrondi2(m.sablePct)} % sur 0–30 cm (seuil 70)`;
    case 'plaine_basse':
      return `altitude ${nombre(m.altitudeM ?? NaN)} m et pente ${arrondi2(m.pentePct ?? NaN)} % (seuil 350 m et 2 %)`;
  }
}

/* ------------------------------------------------------------------ */
/* Formulations : six variantes par emplacement                       */
/* ------------------------------------------------------------------ */

const CONSTATS: Record<Archetype, string[]> = {
  sec: [
    'Votre zone manque d’eau : la pluie s’arrête tôt.',
    'Chez vous, l’eau se fait rare sur la fin de saison.',
    'La pluie ne couvre pas tout ce que l’air demande.',
    'Votre coin est sec, et la saison des pluies est courte.',
    'Ici, la terre boit plus d’eau qu’il n’en tombe.',
    'La sécheresse revient souvent dans votre zone.',
  ],
  pluies_fortes: [
    'Vos pluies tombent fort, en peu de jours.',
    'Chez vous, l’averse arrive d’un coup et ruisselle.',
    'La pluie tombe dru sur votre parcelle.',
    'Votre saison reçoit beaucoup d’eau, très vite.',
    'Les grosses averses sont la règle dans votre coin.',
    'Quand il pleut chez vous, c’est une averse.',
  ],
  pente: [
    'Votre parcelle descend.',
    'Le terrain penche chez vous.',
    'Votre champ est en pente.',
    'Votre champ suit une pente.',
    'Ça descend sur votre parcelle.',
    'Votre terre est inclinée.',
  ],
  terre_lourde: [
    'Votre terre est lourde.',
    'Le sol de votre parcelle est lourd et colle.',
    'Votre terre garde l’eau et se travaille mal.',
    'Chez vous, la terre est lourde.',
    'Votre sol est lourd, avec beaucoup d’argile.',
    'Votre terre est lourde et difficile à travailler.',
  ],
  terre_sableuse: [
    'Votre terre est légère.',
    'L’eau traverse vite votre sol.',
    'Votre terre sableuse ne retient pas l’eau.',
    'Chez vous, le sol est léger et filtrant.',
    'Votre parcelle a une terre légère, qui sèche vite.',
    'Le sable domine dans votre sol.',
  ],
  plaine_basse: [
    'Votre parcelle est en plaine basse.',
    'Vous êtes en terrain plat et bas.',
    'Votre champ est dans une plaine basse.',
    'Chez vous, le terrain est plat et l’eau s’évacue mal.',
    'Votre parcelle est plate, en fond de plaine.',
    'Vous cultivez en plaine, à basse altitude.',
  ],
};

/** Deuxième archétype : une phrase courte, ajoutée après le constat principal. */
const CONSTATS_SECOND: Record<Archetype, string[]> = {
  sec: [
    'La pluie s’arrête tôt.',
    'L’eau manque une partie de la saison.',
    'La saison sèche est longue.',
    'Peu de pluie tombe chez vous.',
    'L’eau se fait rare.',
    'Votre coin reçoit peu de pluie.',
  ],
  pluies_fortes: [
    'La pluie tombe fort.',
    'Les averses sont brutales.',
    'L’eau arrive d’un coup.',
    'Les grosses pluies ruissellent.',
    'La pluie tombe en peu de jours.',
    'Vos averses sont fortes.',
  ],
  pente: [
    'Le terrain descend.',
    'Ça penche chez vous.',
    'Votre champ est en pente.',
    'La pente est marquée.',
    'Votre parcelle suit une pente.',
    'Le sol descend vers l’aval.',
  ],
  terre_lourde: [
    'La terre est lourde.',
    'Votre sol colle.',
    'La terre garde l’eau.',
    'Votre sol est argileux.',
    'La terre se travaille mal.',
    'Votre terre est lourde à travailler.',
  ],
  terre_sableuse: [
    'La terre est légère.',
    'L’eau file vite.',
    'Votre sol sèche vite.',
    'Le sable domine.',
    'Votre terre ne retient pas l’eau.',
    'Le sol est filtrant.',
  ],
  plaine_basse: [
    'Le terrain est plat.',
    'Vous êtes en plaine.',
    'L’eau s’évacue mal.',
    'Le champ est en fond de plaine.',
    'La parcelle est basse.',
    'Le terrain ne s’écoule pas.',
  ],
};

const LIAISONS_FAVORABLES: ((d: Faits) => string)[] = [
  (d) => `${d.rotation} couvre le sol quand ça compte, et ça vous aide ici.`,
  (d) => `Avec ${d.rotation}, la terre reste couverte plus longtemps chez vous.`,
  (d) => `${d.rotation} laisse des restes de récolte au sol, ce qui vous sert ici.`,
  (d) => `Votre rotation proposée, ${d.rotation}, protège mieux votre sol.`,
  (d) => `${d.rotation} étale les cultures dans l’année, et votre terrain respire.`,
  (d) => `Avec ${d.rotation}, vous semez en ${d.moisSemis} et la terre est couverte ensuite.`,
];

const LIAISONS_DEFAVORABLES: ((d: Faits) => string)[] = [
  (d) => `${d.rotation} laisse le sol nu trop longtemps pour votre terrain.`,
  (d) => `Avec ${d.rotation}, votre sol reste exposé une partie de la saison.`,
  (d) => `${d.rotation} demande plus d’eau que votre terrain n’en garde.`,
  (d) => `Votre sol ne suit pas le rythme de ${d.rotation}.`,
  (d) => `${d.rotation} revient sur une culture qui épuise votre terre.`,
  (d) => `${d.rotation} ne couvre pas le sol au bon moment ici.`,
];

const CONSEQUENCES: Record<NiveauVerdict, ((d: Faits, mesure: string) => string)[]> = {
  oui: [
    (d, m) => `Vous gagnez ${m} par rapport à ${d.actuelle}.`,
    (d, m) => `À la vente, c’est ${m} de plus que ${d.actuelle}.`,
    (d, m) => `Le sol y gagne, et vous encaissez ${m} de plus que maintenant.`,
    (d, m) => `Votre revenu augmente de ${m} sur cette parcelle.`,
    (d, m) => `C’est ${m} de mieux que votre rotation actuelle.`,
    (d, m) => `Vous semez en ${d.moisSemis} et vous encaissez ${m} de plus.`,
  ],
  conditionnel: [
    (d, m) => `Ça tient si vous couvrez l’eau ; sinon l’écart tombe à ${m}.`,
    (d, m) => `Oui, avec de l’eau : vous gagnez ${m} sur ${d.actuelle}.`,
    (d, m) => `Ça passe, à condition de sécuriser l’eau : ${m} de mieux.`,
    (d, m) => `Vous pouvez essayer : ${m} de plus, si la pluie ne manque pas.`,
    (d, m) => `C’est jouable, mais l’avantage se limite à ${m}.`,
    (d, m) => `Vous y gagnez ${m}, à condition de surveiller l’eau.`,
  ],
  non: [
    (d, m) => `Ça ne tient pas : vous perdriez ${m} sur votre récolte actuelle.`,
    (d, m) => `Le compte n’y est pas : ${m} en moins que ${d.actuelle}.`,
    (d, m) => `Vous partiriez avec ${m} de moins que maintenant.`,
    (d, m) => `Cette année, l’écart est défavorable : ${m} de perte.`,
    (d, m) => `Ça vous coûterait ${m} par rapport à votre rotation.`,
    (d, m) => `Mieux vaut attendre : ${m} en moins sur la campagne.`,
  ],
};

const RESERVES: string[] = [
  'En contrepartie, trouvez l’acheteur avant de semer.',
  'En contrepartie, gardez une part de la récolte pour la maison.',
  'En contrepartie, prévoyez la main-d’œuvre au bon moment.',
  'En contrepartie, la vente peut être lente cette année.',
  'En contrepartie, surveillez l’eau de près.',
  'En contrepartie, le prix peut baisser à la récolte.',
];

export const MARQUEURS_RESERVE = ['En contrepartie', 'contrepartie'];

/* ------------------------------------------------------------------ */
/* Choix déterministe, sans répétition                                 */
/* ------------------------------------------------------------------ */

/**
 * Tire une variante : départ = hash(parcelle, emplacement) % n, puis on
 * avance tant que la formulation a déjà servi dans ce rapport.
 */
function tirer(parcelle: string, emplacement: string, variantes: string[], deja: Set<string>): string {
  const depart = hash32(`${parcelle}|${emplacement}`) % variantes.length;
  for (let i = 0; i < variantes.length; i += 1) {
    const texte = variantes[(depart + i) % variantes.length];
    if (!deja.has(texte)) {
      deja.add(texte);
      return texte;
    }
  }
  return variantes[depart];
}

/* ------------------------------------------------------------------ */
/* Le chiffre unique de l'explication                                  */
/* ------------------------------------------------------------------ */

const fcfa = (v: number): string => `${nombre(Math.round(Math.abs(v) / 5000) * 5000)} FCFA par hectare`;

/**
 * Une seule mesure, toujours comparée à la rotation actuelle.
 * L'argent d'abord ; l'eau seulement s'il n'y a pas d'écart d'argent net.
 */
function mesureDe(d: Faits, sens: 'gain' | 'perte'): string {
  const ecart = d.ecartRevenuFcfa;
  if (sens === 'gain' && ecart >= 5000) return fcfa(ecart);
  if (sens === 'perte' && ecart <= -5000) return fcfa(ecart);
  if (Number.isFinite(d.manqueEauMm) && d.manqueEauMm >= 10) {
    return `${nombre(Math.round(d.manqueEauMm))} mm d’eau sur la saison`;
  }
  return 'moins de 5 000 FCFA par hectare';
}

/* ------------------------------------------------------------------ */
/* Fonction publique                                                  */
/* ------------------------------------------------------------------ */

const phrase = (xs: string[]): string => xs.filter((x) => x.length > 0).join(' ');

export function expliquer(
  verdict: NiveauVerdict,
  faits: Faits,
  zone: Zone,
  deja: Set<string> = new Set(),
): Explication {
  const pris = zone.archetypes.slice(0, 2);
  const source = 'construireProfil (archétypes) + chercherRotations (écart)';

  /* Aucun archétype : on le dit, au lieu d'inventer une cause. */
  if (pris.length === 0) {
    return {
      texte: `Rien dans votre zone ne départage ${faits.rotation} et ${faits.actuelle}. La différence tient au prix et au travail.`,
      archetypes: [],
      faits: ['aucun seuil d’archétype franchi'],
      source,
    };
  }

  const morceaux: string[] = [];
  morceaux.push(tirer(zone.parcelle, `constat.${pris[0]}`, CONSTATS[pris[0]], deja));
  if (pris[1]) {
    morceaux.push(tirer(zone.parcelle, `constatSecond.${pris[1]}`, CONSTATS_SECOND[pris[1]], deja));
  }

  const favorables = verdict === 'oui' || verdict === 'conditionnel';
  const liaisons = favorables ? LIAISONS_FAVORABLES : LIAISONS_DEFAVORABLES;
  morceaux.push(
    tirer(
      zone.parcelle,
      favorables ? 'liaison.favorable' : 'liaison.defavorable',
      liaisons.map((f) => f(faits)),
      deja,
    ),
  );

  const mesure = mesureDe(faits, verdict === 'non' ? 'perte' : 'gain');
  morceaux.push(
    tirer(
      zone.parcelle,
      `consequence.${verdict}`,
      CONSEQUENCES[verdict].map((f) => f(faits, mesure)),
      deja,
    ),
  );

  /* Un verdict favorable sans réserve serait un conseil déguisé : il en faut une. */
  if (verdict === 'oui') {
    morceaux.push(tirer(zone.parcelle, 'reserve', RESERVES, deja));
  }

  return {
    texte: phrase(morceaux),
    archetypes: pris,
    faits: pris.map((a) => `${NOMS_ARCHETYPE[a]} — ${faitDe(a, zone.mesures)}`),
    source,
  };
}
