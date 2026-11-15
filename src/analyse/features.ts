import { ecartType, mediane, moyenne } from '../api/http';
import type {
  Era5Data,
  HumiditeSolData,
  JourPower,
  PowerData,
  ReliefBrut,
  SolBrut,
} from '../api/sources';

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export interface SourceStatut {
  cle: string;
  nom: string;
  variable: string;
  resolution: string;
  etat: 'ok' | 'echec';
  detail: string;
}

export interface Profil {
  lieu: { nom: string; lat: number; lon: number; pays: string };
  periode: string;
  climat: {
    tMoyenne: number;
    tMoisChaud: number;
    pluieAnnuelle: number;
    pluieSaison: number;
    et0Annuel: number;
    et0Saison: number;
    deficitSaison: number;
    aridite: number;
    zone: string;
    cvPluie: number;
    tendancePluie: number;
    joursChauds: number;
    humiditeSol: number | null;
    sourceEt0: string;
  };
  saison: { gelPrintanier: string | null; gelAutomnal: string | null; duree: number };
  sol: {
    argile: number;
    sable: number;
    limon: number;
    texture: string;
    mo: number;
    ph: number;
    awcMm: number;
    kErosion: number;
    drainage: string;
    origine: 'mesure' | 'wrb' | 'defaut';
    wrb: string | null;
  };
  relief: { altitude: number | null; pente: number | null; exposition: string | null; source: string };
  risques: { erosion: number; stressHydrique: number; variabilite: number };
  graphique: { mois: string[]; pluie: number[]; et0: number[]; humidite: number[] | null; anneeHumidite: number | null };
  sources: SourceStatut[];
}

const somme = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const arrondi = (v: number, d = 1) => Number(v.toFixed(d));

/* ------------------------------------------------------------------ */
/* Rayonnement extraterrestre + ET0 Hargreaves (repli sans ERA5)        */
/* ------------------------------------------------------------------ */

function rayonExtraterrestre(doy: number, lat: number): number {
  const phi = (lat * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const cosWs = Math.min(1, Math.max(-1, -Math.tan(phi) * Math.tan(delta)));
  const ws = Math.acos(cosWs);
  return (
    ((24 * 60) / Math.PI) *
    0.082 *
    dr *
    (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws))
  );
}

function et0Hargreaves(j: JourPower, lat: number): number {
  const ra = rayonExtraterrestre(j.doy, lat);
  const amplitude = Math.max(0.5, j.tmax - j.tmin);
  return Math.max(0, 0.0023 * ra * (j.t + 17.8) * Math.sqrt(amplitude));
}

/* ------------------------------------------------------------------ */
/* Saison de croissance : plus long intervalle sans gelée              */
/* ------------------------------------------------------------------ */

function fenetreSansGel(jours: JourPower[]) {
  const parAnnee = new Map<number, number[]>();
  for (const j of jours) {
    if (j.tmin < 0) {
      const liste = parAnnee.get(j.annee) ?? [];
      liste.push(j.doy);
      parAnnee.set(j.annee, liste);
    }
  }

  const debuts: number[] = [];
  const longueurs: number[] = [];
  const gelsPrintaniers: number[] = [];
  const gelsAutomnaux: number[] = [];

  for (const [, gelees] of parAnnee) {
    if (gelees.length === 0) {
      debuts.push(1);
      longueurs.push(365);
      continue;
    }
    gelees.sort((a, b) => a - b);
    let meilleur = { debut: 1, longueur: -1, gelAvant: 365, gelApres: 365 };
    for (let i = 0; i < gelees.length; i += 1) {
      const gelAvant = gelees[i];
      const gelApres = gelees[(i + 1) % gelees.length];
      const debut = gelAvant + 1;
      const fin = i + 1 === gelees.length ? gelApres + 365 : gelApres;
      const longueur = fin - debut;
      if (longueur > meilleur.longueur) meilleur = { debut, longueur, gelAvant, gelApres };
    }
    debuts.push(((meilleur.debut - 1) % 365) + 1);
    longueurs.push(meilleur.longueur);
    gelsPrintaniers.push(meilleur.gelAvant);
    gelsAutomnaux.push(((meilleur.gelApres - 1) % 365) + 1);
  }

  return {
    debut: Math.round(mediane(debuts)) || 90,
    longueur: Math.round(mediane(longueurs)) || 200,
    gelPrintanier: gelsPrintaniers.length ? Math.round(mediane(gelsPrintaniers)) : null,
    gelAutomnal: gelsAutomnaux.length ? Math.round(mediane(gelsAutomnaux)) : null,
  };
}

const dansSaison = (doy: number, debut: number, longueur: number) =>
  ((doy - debut + 365) % 365) < longueur;

const carteDoy = (doy: number | null) => {
  if (doy === null) return null;
  const d = new Date(Date.UTC(2021, 0, 1));
  d.setUTCDate(doy);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
};

/* ------------------------------------------------------------------ */
/* Pente de régression simple (tendance)                              */
/* ------------------------------------------------------------------ */

function tendance(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = moyenne(xs);
  const my = moyenne(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/* ------------------------------------------------------------------ */
/* Sol                                                                */
/* ------------------------------------------------------------------ */

/** Texture typique par grand groupe de sol mondial (WRB), utilisée quand les
 *  propriétés SoilGrids manquent. Ce n'est pas une mesure : c'est un a priori. */
const PRIOR_WRB: Record<string, { argile: number; sable: number; limon: number }> = {
  Chernozems: { argile: 30, sable: 25, limon: 45 },
  Kastanozems: { argile: 28, sable: 30, limon: 42 },
  Phaeozems: { argile: 28, sable: 30, limon: 42 },
  Umbrisols: { argile: 22, sable: 40, limon: 38 },
  Luvisols: { argile: 26, sable: 35, limon: 39 },
  Retisols: { argile: 24, sable: 36, limon: 40 },
  Lixisols: { argile: 24, sable: 40, limon: 36 },
  Acrisols: { argile: 30, sable: 40, limon: 30 },
  Alisols: { argile: 32, sable: 36, limon: 32 },
  Cambisols: { argile: 22, sable: 40, limon: 38 },
  Fluvisols: { argile: 18, sable: 45, limon: 37 },
  Gleysols: { argile: 30, sable: 30, limon: 40 },
  Stagnosols: { argile: 28, sable: 32, limon: 40 },
  Planosols: { argile: 30, sable: 30, limon: 40 },
  Podzols: { argile: 8, sable: 80, limon: 12 },
  Ferralsols: { argile: 30, sable: 28, limon: 42 },
  Nitisols: { argile: 40, sable: 22, limon: 38 },
  Vertisols: { argile: 48, sable: 18, limon: 34 },
  Andosols: { argile: 20, sable: 40, limon: 40 },
  Regosols: { argile: 15, sable: 55, limon: 30 },
  Arenosols: { argile: 5, sable: 88, limon: 7 },
  Leptosols: { argile: 15, sable: 45, limon: 40 },
  Calcisols: { argile: 20, sable: 42, limon: 38 },
  Gypsisols: { argile: 18, sable: 42, limon: 40 },
  Durisols: { argile: 20, sable: 45, limon: 35 },
  Solonetz: { argile: 35, sable: 40, limon: 25 },
  Solonchaks: { argile: 30, sable: 45, limon: 25 },
  Histosols: { argile: 25, sable: 30, limon: 45 },
};

function classeTexture(argile: number, sable: number, limon: number): string {
  if (argile >= 40) return sable >= 45 ? 'argile sableuse' : limon >= 40 ? 'argile limoneuse' : 'argileuse';
  if (argile >= 27) return sable >= 45 ? 'argile sableuse' : limon >= 40 ? 'argile limoneuse' : 'argilo-limoneuse';
  if (argile >= 20) return sable >= 45 ? 'limon argilo-sableux' : 'limon argileux';
  if (limon >= 80) return 'limoneuse';
  if (limon >= 50) return 'limon';
  if (sable >= 85) return 'sableuse';
  if (limon >= 28) return 'limon sableux';
  return 'sableuse-limoneuse';
}

const K_TEXTURE: [RegExp, number][] = [
  [/argile sableuse/, 0.24],
  [/argile limoneuse/, 0.28],
  [/argileuse/, 0.21],
  [/argilo-limoneuse/, 0.3],
  [/limon argileux/, 0.34],
  [/limon argilo-sableux/, 0.32],
  [/limoneuse/, 0.44],
  [/limon sableux/, 0.36],
  [/^limon$/, 0.4],
  [/sableuse-limoneuse/, 0.22],
  [/sableuse/, 0.09],
];

function facteurK(texture: string): number {
  for (const [motif, k] of K_TEXTURE) if (motif.test(texture)) return k;
  return 0.35;
}

function moyenneProfondeur(couches: { haut: number; bas: number; valeur: number | null }[], haut: number, bas: number) {
  let num = 0;
  let den = 0;
  for (const c of couches) {
    if (c.valeur === null) continue;
    const recouvrement = Math.min(bas, c.bas) - Math.max(haut, c.haut);
    if (recouvrement <= 0) continue;
    num += recouvrement * c.valeur;
    den += recouvrement;
  }
  return den ? num / den : null;
}

/* ------------------------------------------------------------------ */
/* Profil complet                                                     */
/* ------------------------------------------------------------------ */

interface Arguments {
  lieu: { nom: string; lat: number; lon: number; pays: string };
  power: PowerData;
  era5: Era5Data | null;
  humidite: HumiditeSolData | null;
  sol: SolBrut | null;
  relief: ReliefBrut | null;
  classification: string | null;
  statuts: { power: string | null; era5: string | null; humidite: string | null; sol: string | null; relief: string | null };
}

export function construireProfil(a: Arguments): Profil {
  const { power, era5, humidite, sol, relief, lieu } = a;
  const jours = power.jours;

  /* --- Climat général --- */
  const parAnnee = new Map<number, JourPower[]>();
  for (const j of jours) {
    const liste = parAnnee.get(j.annee) ?? [];
    liste.push(j);
    parAnnee.set(j.annee, liste);
  }
  const annees = [...parAnnee.keys()].sort();

  const pluiesAnnuelles = annees.map((an) => somme(parAnnee.get(an)!.map((j) => j.p)));
  const pluieAnnuelle = moyenne(pluiesAnnuelles);
  const cvPluie = pluieAnnuelle > 0 ? (ecartType(pluiesAnnuelles) / pluieAnnuelle) * 100 : 0;
  const tendancePluie = tendance(annees, pluiesAnnuelles) * 10;

  const tMoyenne = moyenne(jours.map((j) => j.t));
  const tParMois = MOIS.map((_, m) =>
    moyenne(jours.filter((j) => Number(j.date.slice(5, 7)) - 1 === m).map((j) => j.t)),
  );
  const tMoisChaud = Math.max(...tParMois.filter((v) => Number.isFinite(v)));

  /* --- Saison --- */
  const saison = fenetreSansGel(jours);

  const pluiesSaison = annees.map((an) =>
    somme(
      parAnnee
        .get(an)!
        .filter((j) => dansSaison(j.doy, saison.debut, saison.longueur))
        .map((j) => j.p),
    ),
  );
  const pluieSaison = moyenne(pluiesSaison);

  /* --- ET0 --- */
  const sourceEt0 = era5 ? 'ERA5 (FAO-56 Penman-Monteith)' : 'Hargreaves, calculée sur NASA POWER';
  let et0Saison = 0;
  let et0Annuel = 0;
  let joursChauds = 0;
  const cumulsEt0 = new Map<string, number>();

  if (era5) {
    const parAnneeEra5 = new Map<number, typeof era5.jours>();
    for (const j of era5.jours) {
      const liste = parAnneeEra5.get(j.annee) ?? [];
      liste.push(j);
      parAnneeEra5.set(j.annee, liste);
    }
    const saisons = [...parAnneeEra5.values()].map((liste) =>
      somme(liste.filter((j) => dansSaison(j.doy, saison.debut, saison.longueur)).map((j) => j.et0)),
    );
    et0Saison = moyenne(saisons);
    et0Annuel = moyenne([...parAnneeEra5.values()].map((liste) => somme(liste.map((j) => j.et0))));
    joursChauds = moyenne(
      [...parAnneeEra5.values()].map(
        (liste) => liste.filter((j) => j.tmax > 30 && dansSaison(j.doy, saison.debut, saison.longueur)).length,
      ),
    );
    for (const j of era5.jours) {
      const cle = `${j.annee}-${Number(j.date.slice(5, 7)) - 1}`;
      cumulsEt0.set(cle, (cumulsEt0.get(cle) ?? 0) + j.et0);
    }
  } else {
    const et0Jour = jours.map((j) => ({ annee: j.annee, doy: j.doy, et0: et0Hargreaves(j, lieu.lat), tmax: j.tmax }));
    const parAnneeEt0 = new Map<number, typeof et0Jour>();
    for (const j of et0Jour) {
      const liste = parAnneeEt0.get(j.annee) ?? [];
      liste.push(j);
      parAnneeEt0.set(j.annee, liste);
    }
    const saisons = [...parAnneeEt0.values()].map((liste) =>
      somme(liste.filter((j) => dansSaison(j.doy, saison.debut, saison.longueur)).map((j) => j.et0)),
    );
    et0Saison = moyenne(saisons);
    et0Annuel = moyenne([...parAnneeEt0.values()].map((liste) => somme(liste.map((j) => j.et0))));
    joursChauds = moyenne(
      [...parAnneeEt0.values()].map(
        (liste) => liste.filter((j) => j.tmax > 30 && dansSaison(j.doy, saison.debut, saison.longueur)).length,
      ),
    );
    for (const j of et0Jour) {
      const date = new Date(Date.UTC(j.annee, 0, 1));
      date.setUTCDate(j.doy);
      const cle = `${j.annee}-${date.getUTCMonth()}`;
      cumulsEt0.set(cle, (cumulsEt0.get(cle) ?? 0) + j.et0);
    }
  }

  const et0Mensuel = MOIS.map((_, m) =>
    moyenne(
      [...cumulsEt0.entries()]
        .filter(([cle]) => Number(cle.split('-')[1]) === m)
        .map(([, v]) => v),
    ),
  );

  const aridite = et0Annuel > 0 ? pluieAnnuelle / et0Annuel : NaN;

  /* --- Graphique mensuel --- */
  const pluieParMois = MOIS.map((_, m) => {
    const totaux: number[] = [];
    for (const an of annees) {
      const total = somme(
        parAnnee
          .get(an)!
          .filter((j) => Number(j.date.slice(5, 7)) - 1 === m)
          .map((j) => j.p),
      );
      totaux.push(total);
    }
    return moyenne(totaux);
  });

  /* --- Sol --- */
  let argile = 24;
  let sable = 38;
  let limon = 38;
  let mo = 2.6;
  let ph = 6.4;
  let awcMm = 0;
  let texture = 'limon argileux';
  let kErosion = 0.34;
  let drainage = 'modéré';
  let origineSol: 'mesure' | 'wrb' | 'defaut' = 'defaut';

  const a30 = sol ? moyenneProfondeur(sol.clay ?? [], 0, 30) : null;
  const s30 = sol ? moyenneProfondeur(sol.sand ?? [], 0, 30) : null;
  const l30 = sol ? moyenneProfondeur(sol.silt ?? [], 0, 30) : null;

  if (a30 !== null || s30 !== null || l30 !== null) {
    origineSol = 'mesure';
    if (a30 !== null) argile = a30;
    if (s30 !== null) sable = s30;
    if (l30 !== null) limon = l30;
    if (a30 === null && s30 !== null && l30 !== null) argile = Math.max(0, 100 - s30 - l30);
    if (s30 === null && a30 !== null && l30 !== null) sable = Math.max(0, 100 - a30 - l30);
    if (l30 === null) limon = Math.max(0, 100 - argile - sable);
  }

  if (sol) {
    const soc = moyenneProfondeur(sol.soc ?? [], 0, 30);
    if (soc !== null) mo = (soc / 10) * 1.724;

    const phVal = moyenneProfondeur(sol.phh2o ?? [], 0, 30);
    if (phVal !== null) ph = phVal;

    const fc = sol.wv0033 ?? [];
    const wp = sol.wv1500 ?? [];
    let awc = 0;
    let mesuree = false;
    for (const couche of fc) {
      const wpCouche = wp.find((w) => w.label === couche.label);
      if (couche.valeur === null || !wpCouche || wpCouche.valeur === null) continue;
      const dispo = (couche.valeur - wpCouche.valeur) / 100;
      if (dispo > 0 && dispo < 0.4) {
        awc += dispo * (couche.bas - couche.haut) * 10;
        mesuree = true;
      }
    }
    if (mesuree && awc > 10) awcMm = awc;
  }

  if (origineSol === 'defaut' && a.classification) {
    const prior = PRIOR_WRB[a.classification] ?? { argile: 22, sable: 40, limon: 38 };
    argile = prior.argile;
    sable = prior.sable;
    limon = prior.limon;
    mo = 2.2;
    ph = 6.4;
    origineSol = 'wrb';
  }

  if (awcMm === 0) awcMm = 40 + argile * 1.4 + Math.max(0, 30 - sable) * 1.2;

  texture = classeTexture(argile, sable, limon);
  kErosion = facteurK(texture);
  drainage =
    argile > 38 ? 'lent (sol lourd)' : sable > 70 ? 'rapide (sol filtrant)' : argile < 18 ? 'assez rapide' : 'modéré';

  /* --- Relief --- */
  const altitude = relief?.altitude ?? power.altitudeGrille ?? null;
  const pente = relief?.pente ?? null;
  const azimut = relief?.exposition ?? null;
  const points = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
  const exposition = azimut === null ? null : points[Math.round(azimut / 45) % 8];

  const deficitSaison = Math.max(0, et0Saison - (pluieSaison * 0.85 + awcMm));

  /* --- Risques --- */
  const pAnnuelle = Math.min(2400, Math.max(150, pluieAnnuelle));
  const rErosivite = 587.8 - 1.219 * pAnnuelle + 0.004105 * pAnnuelle * pAnnuelle;
  const penteFraction = (pente ?? 2) / 100;
  const ls = (100 / 22.13) ** 0.4 * (0.065 + 4.56 * penteFraction + 65.41 * penteFraction ** 2);
  const erosion = Math.max(0.1, (rErosivite * kErosion * ls * 0.25) / 10);

  const zone = (() => {
    if (Number.isNaN(aridite)) return 'non déterminée';
    if (aridite < 0.2) return 'aride';
    if (aridite < 0.5) return 'semi-aride';
    if (aridite < 0.65) return 'sec sub-humide';
    if (tMoyenne < 7) return 'continental froid';
    if (tMoyenne > 22 && pluieAnnuelle > 1200) return 'tropical humide';
    if (tMoyenne > 18) return 'subtropical humide';
    if (aridite > 1) return 'tempéré humide';
    return 'tempéré sub-humide';
  })();

  const statuts: SourceStatut[] = [
    {
      cle: 'power',
      nom: 'NASA POWER',
      variable: 'Pluie, températures, humidité de surface (GWETTOP)',
      resolution: '0,5° × 0,625° · quotidien',
      etat: a.statuts.power ? 'ok' : 'echec',
      detail: a.statuts.power ?? 'source indisponible, indicateurs climatiques partiels',
    },
    {
      cle: 'era5',
      nom: 'ERA5 (Copernicus / ECMWF)',
      variable: 'ET0 FAO-56, gel, jours de chaleur',
      resolution: 'grille native 0,25° (≈ 25–30 km) · horaire agrégé au jour',
      etat: a.statuts.era5 ? 'ok' : 'echec',
      detail: a.statuts.era5 ?? 'ET0 reconstituée par la méthode de Hargreaves',
    },
    {
      cle: 'sol',
      nom: 'SoilGrids (ISRIC)',
      variable: 'Texture, carbone, pH, réserve utile',
      resolution: '250 m · 0–60 cm',
      etat: a.statuts.sol ? 'ok' : 'echec',
      detail: a.statuts.sol ?? 'valeurs de sol par défaut, à remplacer par une analyse de terre',
    },
    {
      cle: 'relief',
      nom: 'SRTM / USGS 3DEP',
      variable: 'Altitude, pente, exposition',
      resolution: '30 m (90 m hors États-Unis)',
      etat: a.statuts.relief ? 'ok' : 'echec',
      detail: a.statuts.relief ?? 'relief non mesuré, pente supposée à 2 %',
    },
    {
      cle: 'humidite',
      nom: 'ERA5-Land',
      variable: 'Humidité du sol 0–7 cm',
      resolution: 'grille native 0,25° (≈ 25–30 km) · horaire → mensuel',
      etat: a.statuts.humidite ? 'ok' : 'echec',
      detail: a.statuts.humidite ?? 'humidité du sol non disponible pour ce point',
    },
    {
      cle: 'imagerie',
      nom: 'NASA GIBS',
      variable: 'Imagerie MODIS Terra (fond de carte)',
      resolution: '250 m · quotidien',
      etat: 'ok',
      detail: 'tuiles d’observation de la Terre disponibles pour la date affichée',
    },
  ];

  return {
    lieu,
    periode: `${annees[0]}–${annees[annees.length - 1]}`,
    climat: {
      tMoyenne,
      tMoisChaud,
      pluieAnnuelle,
      pluieSaison,
      et0Annuel,
      et0Saison,
      deficitSaison,
      aridite,
      zone,
      cvPluie,
      tendancePluie,
      joursChauds,
      humiditeSol: humidite?.moyenne ?? null,
      sourceEt0,
    },
    saison: {
      gelPrintanier: carteDoy(saison.gelPrintanier),
      gelAutomnal: carteDoy(saison.gelAutomnal),
      duree: saison.longueur,
    },
    sol: {
      argile: arrondi(argile),
      sable: arrondi(sable),
      limon: arrondi(limon),
      texture,
      mo: arrondi(mo, 2),
      ph: arrondi(ph, 1),
      awcMm: arrondi(awcMm),
      kErosion: arrondi(kErosion, 2),
      drainage,
      origine: origineSol,
      wrb: a.classification,
    },
    relief: { altitude: altitude === null ? null : arrondi(altitude), pente: pente === null ? null : arrondi(pente, 1), exposition, source: relief?.source ?? 'indisponible' },
    risques: {
      erosion: arrondi(erosion, 1),
      stressHydrique: et0Saison > 0 ? deficitSaison / et0Saison : 0,
      variabilite: arrondi(cvPluie),
    },
    graphique: {
      mois: MOIS,
      pluie: pluieParMois.map((v) => arrondi(v)),
      et0: et0Mensuel.map((v) => arrondi(v)),
      humidite: humidite ? humidite.mensuelle.map((m) => arrondi(m.valeur, 3)) : null,
      anneeHumidite: humidite?.annee ?? null,
    },
    sources: statuts,
  };
}
