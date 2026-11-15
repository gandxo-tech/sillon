/**
 * Contrôle de la couche d'explication : six archétypes, un cas neutre,
 * puis le tableau de contrôle archétype → archétype cité.
 *
 * Aucune dépendance : `tsc -p tsconfig.test.json` compile, Node exécute.
 * `npm test` sort en erreur dès qu'un cas ne passe pas.
 */

import type { Archetype, Faits, Mesures, NiveauVerdict } from '../explication';
import { MARQUEURS_RESERVE, archetypesDe, expliquer, zoneDepuis } from '../explication';

const echecs: string[] = [];

function verifier(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function cas(nom: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok    ${nom}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    echecs.push(nom);
    console.error(`  ÉCHEC ${nom}\n        ${message}`);
  }
}

/* ------------------------------------------------------------------ */
/* Jeux d'essai : une seule mesure change par cas                     */
/* ------------------------------------------------------------------ */

const BASE: Mesures = {
  parcelle: '12.37000,-1.52000',
  pluieAnnuelleMm: 700,
  pluieSaisonMm: 700,
  saisonJours: 150,
  soifAirAnnuelleMm: 1300,
  argilePct: 24,
  sablePct: 38,
  pentePct: 1,
  altitudeM: 800,
  drainage: 'modéré',
};

const FAITS: Faits = {
  rotation: 'Niébé puis Maïs',
  actuelle: 'Maïs puis Maïs',
  ecartRevenuFcfa: 42_000,
  manqueEauMm: 34,
  moisSemis: 'juin',
  moisRecolte: 'octobre',
};

const LEXIQUE_INTERDIT =
  /ET0|évapotranspiration|déficit|RUSLE|érosion|résilience|biomasse|résidus|azote|texture argileuse|réserve utile|viabilité|ITK|coefficient cultural/i;

const compterNombres = (texte: string): number => (texte.match(/\d[\d\u00a0\u202f ]*/g) ?? []).length;

const phrases = (texte: string): string[] =>
  texte
    .split(/[.!?]/)
    .map((s) => s.trim())
    .filter(Boolean);

function controlerTexte(texte: string, verdict: NiveauVerdict): void {
  verifier(texte.length > 0, 'explication vide');
  verifier(!LEXIQUE_INTERDIT.test(texte), `mot interdit dans : ${texte}`);
  verifier(!/\b(il faut|on doit|optimal|recommandé par le modèle)\b/i.test(texte), `tournure interdite : ${texte}`);

  const nb = compterNombres(texte);
  verifier(nb <= 1, `${nb} chiffres dans une explication : ${texte}`);

  for (const p of phrases(texte)) {
    const mots = p.split(/\s+/).filter(Boolean);
    verifier(mots.length <= 20, `phrase de ${mots.length} mots : « ${p} »`);
  }

  verifier(/[.!?]$/.test(texte), `l’explication ne finit pas par une phrase : ${texte}`);

  if (verdict === 'oui') {
    verifier(
      MARQUEURS_RESERVE.some((m) => texte.includes(m)),
      `verdict favorable sans réserve : ${texte}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Six cas, un par archétype                                          */
/* ------------------------------------------------------------------ */

const CAS: { attendu: Archetype; mesures: Mesures }[] = [
  { attendu: 'sec', mesures: { ...BASE, soifAirAnnuelleMm: 2000 } },
  { attendu: 'pluies_fortes', mesures: { ...BASE, pluieSaisonMm: 1200 } },
  { attendu: 'pente', mesures: { ...BASE, pentePct: 6 } },
  { attendu: 'terre_lourde', mesures: { ...BASE, argilePct: 45 } },
  { attendu: 'terre_sableuse', mesures: { ...BASE, sablePct: 78 } },
  { attendu: 'plaine_basse', mesures: { ...BASE, altitudeM: 120 } },
];

for (const { attendu, mesures } of CAS) {
  cas(`archétype ${attendu} : détecté, cité, texte conforme`, () => {
    const declares = archetypesDe(mesures);
    verifier(
      declares.length === 1 && declares[0] === attendu,
      `archétypes déclenchés : ${declares.join(', ') || 'aucun'} (attendu ${attendu})`,
    );

    const ex = expliquer('oui', FAITS, zoneDepuis(mesures));
    verifier(
      ex.archetypes.length === 1 && ex.archetypes[0] === attendu,
      `cité : ${ex.archetypes.join(', ') || 'aucun'}`,
    );
    verifier(ex.faits.length === 1, 'le fait chiffré manque');
    controlerTexte(ex.texte, 'oui');
  });
}

/* ------------------------------------------------------------------ */
/* Cas neutre                                                         */
/* ------------------------------------------------------------------ */

cas('cas neutre : aucun archétype déclenché, aucune cause inventée', () => {
  const zone = zoneDepuis(BASE);
  verifier(zone.archetypes.length === 0, `archétypes déclenchés à tort : ${zone.archetypes.join(', ')}`);
  const ex = expliquer('conditionnel', FAITS, zone);
  verifier(ex.archetypes.length === 0, 'un archétype est cité sans être déclenché');
  verifier(/ne départage/.test(ex.texte), `explication neutre attendue : ${ex.texte}`);
  controlerTexte(ex.texte, 'conditionnel');
});

/* ------------------------------------------------------------------ */
/* Deux archétypes au maximum, et jamais un non déclenché             */
/* ------------------------------------------------------------------ */

cas('archétypes cumulés : les deux plus déterminants, jamais un troisième', () => {
  const mesures: Mesures = { ...BASE, pentePct: 6, argilePct: 45, soifAirAnnuelleMm: 2000 };
  const declares = archetypesDe(mesures);
  verifier(declares.length === 3, `trois archétypes attendus ici, obtenus : ${declares.join(', ')}`);
  const ex = expliquer('oui', FAITS, zoneDepuis(mesures));
  verifier(ex.archetypes.length === 2, `${ex.archetypes.length} archétypes cités`);
  verifier(
    ex.archetypes.every((a) => declares.includes(a)),
    'un archétype cité n’est pas déclenché',
  );
  controlerTexte(ex.texte, 'oui');
});

/* ------------------------------------------------------------------ */
/* Déterminisme et non-répétition                                     */
/* ------------------------------------------------------------------ */

cas('déterminisme : deux appels identiques donnent le même texte', () => {
  const zone = zoneDepuis({ ...BASE, pentePct: 6 });
  const a = expliquer('oui', FAITS, zone);
  const b = expliquer('oui', FAITS, zone);
  verifier(a.texte === b.texte, `textes différents : « ${a.texte} » / « ${b.texte} »`);
});

cas('non-répétition : deux explications d’un même rapport ne se copient pas', () => {
  const zone = zoneDepuis({ ...BASE, pentePct: 6 });
  const deja = new Set<string>();
  const a = expliquer('oui', FAITS, zone, deja);
  const b = expliquer('oui', { ...FAITS, actuelle: 'Sorgho puis Sorgho' }, zone, deja);
  verifier(a.texte !== b.texte, 'la même formulation a servi deux fois dans un rapport');
});

/* ------------------------------------------------------------------ */
/* Tableau de contrôle                                               */
/* ------------------------------------------------------------------ */

const TOTAL = CAS.length + 5;

console.log('\n  Tableau de contrôle — archétype déclenché → archétype cité');
console.log('  ----------------------------------------------------------');
for (const { attendu, mesures } of CAS) {
  const declare = archetypesDe(mesures);
  const ex = expliquer('oui', FAITS, zoneDepuis(mesures));
  const cite = ex.archetypes.join(', ') || '—';
  const ok = ex.archetypes.length === 1 && ex.archetypes[0] === attendu;
  console.log(`  ${attendu.padEnd(14)} → ${cite.padEnd(26)} ${ok ? 'ok' : 'ÉCHEC'}`);
  verifier(ok, `tableau de contrôle : ${attendu} déclenché [${declare.join(', ')}], cité [${cite}]`);
}
{
  const ex = expliquer('conditionnel', FAITS, zoneDepuis(BASE));
  const cite = ex.archetypes.length ? ex.archetypes.join(', ') : 'aucun (neutre)';
  const ok = ex.archetypes.length === 0;
  console.log(`  ${'aucun'.padEnd(14)} → ${cite.padEnd(26)} ${ok ? 'ok' : 'ÉCHEC'}`);
  verifier(ok, `tableau de contrôle : archétype cité sans être déclenché [${cite}]`);
}

/* ------------------------------------------------------------------ */

if (echecs.length) {
  // Une exception non rattrapée fait sortir Node en erreur, sans dépendance.
  throw new Error(`${echecs.length} cas sur ${TOTAL} échouent : ${echecs.join(' | ')}`);
}
console.log(`\n${TOTAL} cas sur ${TOTAL} passent.`);
