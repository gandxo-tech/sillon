import { fetchJson } from './http';

/* ------------------------------------------------------------------ */
/* Géocodage                                                           */
/* ------------------------------------------------------------------ */

export interface Lieu {
  nom: string;
  detail: string;
  pays: string;
  lat: number;
  lon: number;
}

interface ReponseGeocodage {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    country_code?: string;
    admin1?: string;
    admin2?: string;
    timezone?: string;
  }[];
}

export async function chercherLieux(requete: string): Promise<Lieu[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    requete,
  )}&count=6&language=fr&format=json`;
  const data = await fetchJson<ReponseGeocodage>(url, 12000);
  return (data.results ?? []).map((r) => ({
    nom: r.name,
    detail: [r.admin2, r.admin1].filter(Boolean).join(', '),
    pays: r.country ?? '',
    lat: r.latitude,
    lon: r.longitude,
  }));
}

interface ReponseNominatim {
  display_name?: string;
  address?: Record<string, string>;
}

export async function nommerLieu(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(
      5,
    )}&lon=${lon.toFixed(5)}&zoom=12&accept-language=fr`;
    const data = await fetchJson<ReponseNominatim>(url, 12000);
    const a = data.address ?? {};
    const morceaux = [
      a.village ?? a.town ?? a.city ?? a.municipality ?? a.county,
      a.state ?? a.region,
      a.country,
    ].filter(Boolean);
    return morceaux.length ? morceaux.join(', ') : (data.display_name ?? null);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* NASA POWER — agroclimatologie quotidienne réelle                    */
/* ------------------------------------------------------------------ */

const PARAMS_POWER = ['PRECTOTCORR', 'T2M', 'T2M_MAX', 'T2M_MIN', 'GWETTOP'];

export interface JourPower {
  date: string;
  annee: number;
  doy: number;
  p: number;
  t: number;
  tmax: number;
  tmin: number;
  gwet: number | null;
}

export interface PowerData {
  altitudeGrille: number | null;
  jours: JourPower[];
  debut: string;
  fin: string;
}

interface ReponsePower {
  geometry?: { coordinates?: [number, number, number] };
  properties?: { parameter?: Record<string, Record<string, number>> };
}

function doyDepuisDate(iso: string): number {
  const [a, m, j] = iso.split('-').map(Number);
  const debut = Date.UTC(a, 0, 1);
  return Math.round((Date.UTC(a, m - 1, j) - debut) / 86400000) + 1;
}

export async function chargerPower(
  lat: number,
  lon: number,
  annees = 10,
): Promise<PowerData> {
  const finAnnee = new Date().getUTCFullYear() - 1;
  const debutAnnee = finAnnee - annees + 1;
  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${PARAMS_POWER.join(',')}` +
    `&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}` +
    `&start=${debutAnnee}0101&end=${finAnnee}1231&format=JSON`;

  const data = await fetchJson<ReponsePower>(url, 45000);
  const params = data.properties?.parameter;
  if (!params?.T2M || !params.PRECTOTCORR) throw new Error('Réponse POWER incomplète');

  const dates = Object.keys(params.T2M).sort();
  const jours: JourPower[] = [];

  for (const cle of dates) {
    const t = params.T2M[cle];
    const p = params.PRECTOTCORR[cle];
    if (t === undefined || p === undefined || t <= -900 || p <= -900) continue;
    const iso = `${cle.slice(0, 4)}-${cle.slice(4, 6)}-${cle.slice(6, 8)}`;
    const tmax = params.T2M_MAX?.[cle];
    const tmin = params.T2M_MIN?.[cle];
    const gwet = params.GWETTOP?.[cle];
    jours.push({
      date: iso,
      annee: Number(cle.slice(0, 4)),
      doy: doyDepuisDate(iso),
      p,
      t,
      tmax: tmax !== undefined && tmax > -900 ? tmax : t,
      tmin: tmin !== undefined && tmin > -900 ? tmin : t,
      gwet: gwet !== undefined && gwet > -900 ? gwet : null,
    });
  }

  if (jours.length < 300) throw new Error('Trop peu de jours exploitables');

  return {
    altitudeGrille: data.geometry?.coordinates?.[2] ?? null,
    jours,
    debut: `${debutAnnee}`,
    fin: `${finAnnee}`,
  };
}

/* ------------------------------------------------------------------ */
/* ERA5 (Open-Meteo Archive) — ET0 / gel / humidité du sol             */
/* ------------------------------------------------------------------ */

export interface JourEra5 {
  date: string;
  annee: number;
  doy: number;
  p: number;
  t: number;
  tmin: number;
  tmax: number;
  et0: number;
}

export interface Era5Data {
  altitude: number | null;
  jours: JourEra5[];
  debut: string;
  fin: string;
}

interface ReponseEra5 {
  elevation?: number;
  daily?: {
    time: string[];
    precipitation_sum: (number | null)[];
    temperature_2m_mean: (number | null)[];
    temperature_2m_min: (number | null)[];
    temperature_2m_max: (number | null)[];
    et0_fao_evapotranspiration: (number | null)[];
  };
}

export async function chargerEra5(
  lat: number,
  lon: number,
  annees = 5,
): Promise<Era5Data> {
  const finAnnee = new Date().getUTCFullYear() - 1;
  const debutAnnee = finAnnee - annees + 1;
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&start_date=${debutAnnee}-01-01&end_date=${finAnnee}-12-31` +
    '&daily=precipitation_sum,temperature_2m_mean,temperature_2m_min,temperature_2m_max,et0_fao_evapotranspiration' +
    '&timezone=auto';

  const data = await fetchJson<ReponseEra5>(url, 40000);
  const d = data.daily;
  if (!d?.time?.length) throw new Error('Réponse ERA5 vide');

  const jours: JourEra5[] = [];
  d.time.forEach((date, i) => {
    const p = d.precipitation_sum[i];
    const t = d.temperature_2m_mean[i];
    if (p === null || t === null) return;
    jours.push({
      date,
      annee: Number(date.slice(0, 4)),
      doy: doyDepuisDate(date),
      p,
      t,
      tmin: d.temperature_2m_min[i] ?? t,
      tmax: d.temperature_2m_max[i] ?? t,
      et0: d.et0_fao_evapotranspiration[i] ?? 0,
    });
  });

  if (jours.length < 300) throw new Error('Trop peu de jours ERA5');
  return { altitude: data.elevation ?? null, jours, debut: `${debutAnnee}`, fin: `${finAnnee}` };
}

interface ReponseHumidite {
  hourly?: { time: string[]; soil_moisture_0_to_7cm: (number | null)[] };
}

export interface HumiditeSolData {
  mensuelle: { cle: string; label: string; valeur: number }[];
  moyenne: number;
  annee: number;
}

export async function chargerHumiditeSol(lat: number, lon: number): Promise<HumiditeSolData> {
  const annee = new Date().getUTCFullYear() - 1;
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&start_date=${annee}-01-01&end_date=${annee}-12-31` +
    '&hourly=soil_moisture_0_to_7cm&timezone=auto';

  const data = await fetchJson<ReponseHumidite>(url, 40000);
  const h = data.hourly;
  if (!h?.time?.length) throw new Error('Humidité du sol indisponible');

  const seaux: Record<string, number[]> = {};
  h.time.forEach((t, i) => {
    const v = h.soil_moisture_0_to_7cm[i];
    if (v === null || Number.isNaN(v)) return;
    const cle = t.slice(0, 7);
    (seaux[cle] ??= []).push(v);
  });

  const noms = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const mensuelle = Object.keys(seaux)
    .sort()
    .map((cle) => ({
      cle,
      label: noms[Number(cle.slice(5, 7)) - 1],
      valeur: seaux[cle].reduce((s, x) => s + x, 0) / seaux[cle].length,
    }));

  const toutes = Object.values(seaux).flat();
  return {
    mensuelle,
    moyenne: toutes.reduce((s, x) => s + x, 0) / toutes.length,
    annee,
  };
}

/* ------------------------------------------------------------------ */
/* SoilGrids (ISRIC) — sol réel, mondial                               */
/* ------------------------------------------------------------------ */

export interface CoucheSol {
  haut: number;
  bas: number;
  label: string;
  valeur: number | null;
}

export type SolBrut = Record<string, CoucheSol[]>;

const PROFONDEURS = ['0-5cm', '5-15cm', '15-30cm', '30-60cm'];
const PROPRIETES = ['clay', 'sand', 'silt', 'soc', 'phh2o', 'wv0033', 'wv1500'];

interface ReponseSol {
  properties?: {
    layers?: {
      name: string;
      unit_measure?: { d_factor?: number };
      depths?: { label: string; values?: { mean?: number | null } }[];
    }[];
  };
}

async function solIsric(lat: number, lon: number): Promise<SolBrut> {
  const champs = PROPRIETES.map((p) => `property=${p}`).join('&');
  const profs = PROFONDEURS.map((d) => `depth=${d}`).join('&');
  const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon.toFixed(
    5,
  )}&lat=${lat.toFixed(5)}&${champs}&${profs}&value=mean`;

  const data = await fetchJson<ReponseSol>(url, 8000);
  const layers = data.properties?.layers;
  if (!layers?.length) throw new Error('Aucune donnée de sol');

  const sortie: SolBrut = {};
  for (const couche of layers) {
    const facteur = couche.unit_measure?.d_factor ?? 1;
    sortie[couche.name] = (couche.depths ?? []).map((d) => {
      const [haut, bas] = d.label.replace('cm', '').split('-').map(Number);
      const brute = d.values?.mean;
      return {
        label: d.label,
        haut,
        bas,
        valeur: brute === null || brute === undefined ? null : brute / facteur,
      };
    });
  }
  const exploitable = Object.values(sortie).some((couches) =>
    couches.some((c) => c.valeur !== null),
  );
  if (!exploitable) throw new Error('SoilGrids ne renvoie aucune valeur pour ce point');
  return sortie;
}

interface ReponsePixelGust {
  soil: Record<string, Record<string, number>>;
  pixel?: { distance_m?: number; nearest?: boolean; note?: string };
  source?: { dataset?: string };
}

/** Repli PixelGust : ré-encodage de SoilGrids 2.0, qui renvoie le pixel voisin
 *  quand le pixel exact n'a pas de prédiction (zone bâtie, eau, glace). */
async function solPixelGust(lat: number, lon: number): Promise<{ brut: SolBrut; note: string }> {
  const data = await fetchJson<ReponsePixelGust>(
    `https://pixelgust.com/v1/soil?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`,
    45000,
  );
  if (!data.soil) throw new Error('PixelGust : réponse vide');

  const sortie: SolBrut = {};
  for (const [propriete, profondeurs] of Object.entries(data.soil)) {
    if (propriete === 'units' || typeof profondeurs !== 'object') continue;
    sortie[propriete] = Object.entries(profondeurs).map(([label, valeur]) => {
      const [haut, bas] = label.replace('cm', '').split('-').map(Number);
      return { label, haut: haut ?? 0, bas: bas ?? 0, valeur: Number(valeur) };
    });
  }
  const exploitable = Object.values(sortie).some((couches) =>
    couches.some((c) => c.valeur !== null),
  );
  if (!exploitable) throw new Error('PixelGust : aucune valeur de sol');

  const note =
    data.pixel?.nearest && data.pixel.distance_m
      ? `pixel exact sans prédiction — valeurs du pixel voisin à ${Math.round(data.pixel.distance_m)} m`
      : 'pixel du point';
  return { brut: sortie, note };
}

export interface SolCharge {
  brut: SolBrut;
  fournisseur: string;
  note: string;
}

export async function chargerSol(lat: number, lon: number): Promise<SolCharge> {
  try {
    return {
      brut: await solIsric(lat, lon),
      fournisseur: 'ISRIC — SoilGrids 2.0 (accès direct)',
      note: '7 propriétés, 4 horizons (0–60 cm)',
    };
  } catch {
    const repli = await solPixelGust(lat, lon);
    return {
      brut: repli.brut,
      fournisseur: 'PixelGust → SoilGrids 2.0',
      note: repli.note,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Prévisions 14 jours (Open-Meteo)                                    */
/* ------------------------------------------------------------------ */

export interface JourPrevision {
  date: string;
  label: string;
  pluie: number;
  tmin: number;
  tmax: number;
  et0: number;
}

export interface Previsions {
  jours: JourPrevision[];
  cumulPluie: number;
  cumulEt0: number;
  deficit: number;
  joursGel: number;
  joursChauds: number;
  prochainePluie: { label: string; mm: number } | null;
}

interface ReponsePrevision {
  daily?: {
    time: string[];
    precipitation_sum: (number | null)[];
    temperature_2m_min: (number | null)[];
    temperature_2m_max: (number | null)[];
    et0_fao_evapotranspiration: (number | null)[];
  };
}

export async function chargerPrevisions(lat: number, lon: number): Promise<Previsions> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    '&daily=precipitation_sum,temperature_2m_min,temperature_2m_max,et0_fao_evapotranspiration' +
    '&forecast_days=14&timezone=auto';

  const data = await fetchJson<ReponsePrevision>(url, 25000);
  const d = data.daily;
  if (!d?.time?.length) throw new Error('Prévisions indisponibles');

  const jours: JourPrevision[] = d.time.map((date, i) => ({
    date,
    label: new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
    pluie: d.precipitation_sum[i] ?? 0,
    tmin: d.temperature_2m_min[i] ?? 0,
    tmax: d.temperature_2m_max[i] ?? 0,
    et0: d.et0_fao_evapotranspiration[i] ?? 0,
  }));

  const cumulPluie = jours.reduce((s, j) => s + j.pluie, 0);
  const cumulEt0 = jours.reduce((s, j) => s + j.et0, 0);
  const pluvieux = jours.find((j) => j.pluie >= 5);

  return {
    jours,
    cumulPluie,
    cumulEt0,
    deficit: Math.max(0, cumulEt0 - cumulPluie),
    joursGel: jours.filter((j) => j.tmin < 0).length,
    joursChauds: jours.filter((j) => j.tmax > 30).length,
    prochainePluie: pluvieux ? { label: pluvieux.label, mm: pluvieux.pluie } : null,
  };
}

/* ------------------------------------------------------------------ */
/* Projection climatique CMIP6 (Open-Meteo Climate API)                */
/* ------------------------------------------------------------------ */

export interface Projection {
  modele: string;
  deltaT: number;
  deltaP: number;
  refPluie: number;
  futPluie: number;
}

interface ReponseClimat {
  daily?: {
    time: string[];
    precipitation_sum: (number | null)[];
    temperature_2m_mean: (number | null)[];
  };
}

async function fenetreClimat(
  lat: number,
  lon: number,
  debut: string,
  fin: string,
  modele: string,
): Promise<{ t: number[]; p: number[] }> {
  const url =
    `https://climate-api.open-meteo.com/v1/climate?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&start_date=${debut}&end_date=${fin}&models=${modele}` +
    '&daily=temperature_2m_mean,precipitation_sum';
  const data = await fetchJson<ReponseClimat>(url, 45000);
  const d = data.daily;
  if (!d?.time?.length) throw new Error('Projection vide');
  return {
    t: d.temperature_2m_mean.filter((v): v is number => v !== null),
    p: d.precipitation_sum.filter((v): v is number => v !== null),
  };
}

export async function chargerProjection(lat: number, lon: number): Promise<Projection> {
  const modele = 'MRI_AGCM3_2_S';
  const [ref, fut] = await Promise.all([
    fenetreClimat(lat, lon, '1995-01-01', '1999-12-31', modele),
    fenetreClimat(lat, lon, '2045-01-01', '2049-12-31', modele),
  ]);
  if (!ref.t.length || !fut.t.length) throw new Error('Projection incomplète');
  const moyenne = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const refPluie = moyenne(ref.p) * 365;
  const futPluie = moyenne(fut.p) * 365;
  return {
    modele,
    deltaT: moyenne(fut.t) - moyenne(ref.t),
    deltaP: refPluie > 0 ? ((futPluie - refPluie) / refPluie) * 100 : 0,
    refPluie,
    futPluie,
  };
}

interface ReponseClassification {
  wrb_class_name?: string;
}

/** Classe de sol mondiale (WRB) — disponible même là où les propriétés manquent. */
export async function chargerClassificationSol(
  lat: number,
  lon: number,
): Promise<string | null> {
  try {
    const data = await fetchJson<ReponseClassification>(
      `https://rest.isric.org/soilgrids/v2.0/classification/query?lon=${lon.toFixed(5)}&lat=${lat.toFixed(
        5,
      )}&number_classes=1`,
      8000,
    );
    return data.wrb_class_name ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Relief — SRTM (USGS EPQS aux États-Unis, Open-Meteo ailleurs)        */
/* ------------------------------------------------------------------ */

export interface ReliefBrut {
  altitude: number | null;
  pente: number | null;
  exposition: number | null;
  source: string;
}

async function pointEpqs(lat: number, lon: number): Promise<number> {
  const url = `https://epqs.nationalmap.gov/v1/json?x=${lon.toFixed(
    5,
  )}&y=${lat.toFixed(5)}&wkid=4326&units=Meters&includeDate=false`;
  const data = await fetchJson<{ value: string | number }>(url, 15000);
  const v = Number(data.value);
  if (!Number.isFinite(v) || v < -500) throw new Error('Altitude invalide');
  return v;
}

async function pointOpenMeteo(lat: number, lon: number): Promise<number> {
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`;
  const data = await fetchJson<{ elevation: number[] }>(url, 8000);
  if (!data.elevation?.length) throw new Error('Altitude invalide');
  return data.elevation[0];
}

export async function chargerRelief(lat: number, lon: number): Promise<ReliefBrut> {
  const d = 0.009; // ≈ 1 km
  const dLon = d / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const points: [number, number][] = [
    [lat, lon],
    [lat + d, lon],
    [lat - d, lon],
    [lat, lon + dLon],
    [lat, lon - dLon],
  ];

  const auxEtatsUnis = lat > 15 && lat < 75 && lon > -180 && lon < -60;

  let altitudes: number[] | null = null;
  let source = '';

  if (auxEtatsUnis) {
    try {
      altitudes = await Promise.all(points.map(([la, lo]) => pointEpqs(la, lo)));
      source = 'USGS 3DEP / SRTM (1 m aux États-Unis)';
    } catch {
      altitudes = null;
    }
  }

  if (!altitudes) {
    try {
      const reponses = await Promise.all(points.map(([la, lo]) => pointOpenMeteo(la, lo)));
      altitudes = reponses;
      source = 'Copernicus DEM 90 m (Open-Meteo)';
    } catch {
      altitudes = null;
    }
  }

  if (!altitudes) {
    return { altitude: null, pente: null, exposition: null, source: 'indisponible' };
  }

  const [z0, zN, zS, zE, zO] = altitudes;
  const dist = d * 111320;
  const dzdx = (zE - zO) / (2 * dist);
  const dzdy = (zN - zS) / (2 * dist);
  const pente = Math.sqrt(dzdx * dzdx + dzdy * dzdy) * 100;
  const azimut = ((Math.atan2(-dzdx, -dzdy) * 180) / Math.PI + 360) % 360;

  return { altitude: z0, pente, exposition: azimut, source };
}

/* ------------------------------------------------------------------ */
/* Imagerie satellite réelle (NASA GIBS)                               */
/* ------------------------------------------------------------------ */

export function tuilesGibs(date: string): string {
  return (
    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/' +
    `${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
  );
}
