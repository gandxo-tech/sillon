/**
 * Les cinq cas du livrable.
 *
 * Aucune dépendance : tsc compile ce fichier en JavaScript, Node l'exécute.
 * `npm test` sort en erreur dès qu'un cas ne passe pas.
 */

import { resoudreCulture } from '../../analyse/rotations';
import { CULTURES } from '../../data/cultures';
import { chercherRotations, construireEspace } from '../moteur';
import type { SortieMoteur } from '../moteur';
import { CAS_1, CAS_2, CAS_3, CAS_4A, CAS_4B, CAS_5 } from './scenarios';

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

const estCouvertSeul = (s: SortieMoteur): boolean =>
  s.classement.some((c) => c.cultures.every((x) => x.typeCulture === 'couvert'));

/* 1. Parcelle sèche, priorité revenu : pas de couvert seul dans le classement. */
cas('1. parcelle sèche + priorité revenu → pas de couvert seul', () => {
  const sortie = chercherRotations(CAS_1.entree);
  verifier(sortie.classement.length > 0, 'aucune rotation retenue : le moteur ne cherche plus');
  verifier(!estCouvertSeul(sortie), 'une couverture seule a été retenue');
  for (const candidat of sortie.classement.slice(0, 3)) {
    verifier(
      candidat.cultures.some((c) => c.typeCulture !== 'couvert'),
      `${candidat.nom} ne produit rien : couverture seule`,
    );
  }
  verifier(
    sortie.classement.every((c) => c.metriques.base.stress <= 0.55),
    'une rotation trop assoiffée a passé le filtre',
  );
});

/* 2. Sans cheptel : la luzerne disparaît du classement et s'explique dans les rejets. */
cas('2. sans cheptel → aucune rotation avec luzerne, et la raison est écrite', () => {
  const sortie = chercherRotations(CAS_2.entree);
  verifier(
    sortie.classement.every((c) => !c.suite.includes('luzerne')),
    'une rotation contenant de la luzerne est classée sans cheptel',
  );
  verifier(
    sortie.rejets.some((r) => r.code === 'MARCHE' && /luzerne|brachiaria/i.test(r.phrase)),
    'la luzerne n’apparaît pas dans les rejets avec sa raison',
  );
});

/* 3. Historique contenant du maïs : maïs absent des deux premières années. */
cas('3. historique avec maïs → maïs absent des deux premières années', () => {
  const sortie = chercherRotations(CAS_3.entree);
  verifier(sortie.classement.length > 0, 'aucune rotation retenue : test vide');
  for (const candidat of sortie.classement) {
    const deuxPremieres = candidat.suite.slice(0, 2);
    verifier(
      !deuxPremieres.includes('mais'),
      `${candidat.nom} remet le maïs dans les deux premières années`,
    );
  }
  verifier(
    sortie.rejets.some((r) => r.code === 'RETOUR'),
    'aucun rejet motivé par le retour d’une culture',
  );
});

/* 4. Deux jeux de priorités opposés : les classements diffèrent. */
cas('4. priorités opposées sur la même parcelle → classements différents', () => {
  const argent = chercherRotations(CAS_4A.entree);
  const maison = chercherRotations(CAS_4B.entree);
  const ordreArgent = argent.classement.slice(0, 3).map((c) => c.id);
  const ordreMaison = maison.classement.slice(0, 3).map((c) => c.id);
  verifier(ordreArgent.length > 0 && ordreMaison.length > 0, 'classement vide');
  verifier(
    JSON.stringify(ordreArgent) !== JSON.stringify(ordreMaison),
    `les deux jeux de priorités donnent le même classement : ${ordreArgent.join(' > ')}`,
  );
});

/* 5. Même entrée deux fois : sortie identique, octet pour octet. */
cas('5. même entrée deux fois → sortie identique', () => {
  const a = chercherRotations(CAS_5.entree);
  const b = chercherRotations(CAS_5.entree);
  const texteA = JSON.stringify(a);
  const texteB = JSON.stringify(b);
  verifier(texteA === texteB, 'deux exécutions identiques divergent');
  verifier(a.graine === b.graine, 'la graine change entre deux exécutions');
});

/* 6. N'importe quelle culture : une inconnue est acceptée et entre dans la recherche. */
cas('6. culture inconnue acceptée et réellement cherchée', () => {
  const inconnue = resoudreCulture('tournesol');
  verifier(inconnue.approx, 'la culture inconnue devrait être signalée comme estimée');
  const espace = construireEspace([inconnue.culture, CULTURES.mais], 200);
  verifier(
    espace.some((s) => s.cultures.some((c) => c.id === inconnue.culture.id)),
    'la culture saisie n’entre pas dans l’espace de recherche',
  );
  const sortie = chercherRotations({
    ...CAS_5.entree,
    actuelle: [inconnue.culture, CULTURES.mais],
  });
  verifier(sortie.classement.length > 0, 'aucune succession retenue avec une culture libre');
  verifier(
    sortie.reference.suite.includes(inconnue.culture.id),
    'la rotation de référence ignore la culture saisie',
  );
});

console.log('');
if (echecs.length) {
  console.error(`${echecs.length} cas en échec : ${echecs.join(' | ')}`);
  (globalThis as unknown as { process: { exitCode: number } }).process.exitCode = 1;
} else {
  console.log('6 cas sur 6 passent.');
}
