/**
 * Leviers : un rejet doit ouvrir une action, jamais un mur.
 *
 * Aucune dépendance : tsc compile ce fichier en JavaScript, Node l'exécute.
 */

import { chercherRotations } from '../../moteur/moteur';
import { CAS_2, CAS_3, CAS_5 } from '../../moteur/__tests__/scenarios';
import { leviers, resumeLeviers } from '../leviers';

const echecs: string[] = [];
let total = 0;

function verifier(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function cas(nom: string, fn: () => void): void {
  total += 1;
  try {
    fn();
    console.log(`  ok    ${nom}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    echecs.push(nom);
    console.error(`  ÉCHEC ${nom}\n        ${message}`);
  }
}

/* 1. Sans cheptel, la culture fourragère déclarée est écartée : on doit dire quoi faire. */
cas('1. sans cheptel → une action sur le débouché fourrager', () => {
  const liste = leviers(chercherRotations(CAS_2.entree));
  verifier(liste.length > 0, 'aucun levier proposé alors que des rotations sont écartées');
  const marche = liste.find((l) => l.code === 'MARCHE');
  verifier(marche !== undefined, 'le motif « pas de débouché » ne donne aucune action');
  verifier((marche?.cas ?? 0) > 0, 'le compteur de cas est nul');
  for (const levier of liste) {
    verifier(levier.action.length > 40, `action trop courte pour être utile : ${levier.action}`);
  }
});

/* 2. Trois leviers au maximum, classés par nombre de cas débloqués. */
cas('2. trois leviers au plus, du plus débloquant au moins débloquant', () => {
  const sortie = chercherRotations(CAS_3.entree);
  const liste = leviers(sortie);
  verifier(sortie.rejets.length > 0, 'aucun rejet : le cas ne teste rien');
  verifier(liste.length > 0 && liste.length <= 3, `nombre de leviers inattendu : ${liste.length}`);
  for (let i = 1; i < liste.length; i += 1) {
    verifier(
      liste[i - 1].cas >= liste[i].cas,
      `ordre non décroissant : ${liste[i - 1].cas} puis ${liste[i].cas}`,
    );
  }
  const somme = liste.reduce((n, l) => n + l.cas, 0);
  verifier(somme > 0, 'les leviers ne comptent aucun cas');
});

/* 3. Déterminisme : même sortie de moteur, mêmes leviers. */
cas('3. même entrée deux fois → mêmes leviers', () => {
  const a = chercherRotations(CAS_3.entree);
  const b = chercherRotations(CAS_3.entree);
  verifier(
    JSON.stringify(leviers(a)) === JSON.stringify(leviers(b)),
    'deux exécutions identiques donnent des leviers différents',
  );
});

/* 4. Le résumé envoyé à l'IA porte le motif dominant, ou rien s'il n'y a pas de rejet. */
cas('4. résumé pour l’IA : motif dominant, ou rien', () => {
  const sortie = chercherRotations(CAS_3.entree);
  const liste = leviers(sortie);
  const resume = resumeLeviers(liste);
  verifier(resume !== null, 'aucun résumé alors que des rejets existent');
  verifier(
    resume !== null && resume.includes(String(liste[0].cas)),
    'le résumé ne cite pas le nombre de cas du motif dominant',
  );
  verifier(
    resume !== null && resume.includes(liste[0].action),
    'le résumé ne reprend pas l’action du motif dominant',
  );
  verifier(resumeLeviers([]) === null, 'un résumé est produit sans aucun rejet');
});

/* 5. Les actions restent lisibles : pas de vocabulaire du moteur. */
cas('5. actions sans jargon interne', () => {
  const liste = leviers(chercherRotations(CAS_5.entree));
  const interdits = ['score', 'métrique', 'metrique', 'archétype', 'archetype', 'indice', 'seuil'];
  for (const levier of liste) {
    for (const mot of interdits) {
      verifier(
        !levier.action.toLowerCase().includes(mot),
        `l’action « ${levier.code} » contient « ${mot} »`,
      );
    }
  }
});

console.log('');
if (echecs.length) {
  console.error(`${echecs.length} cas en échec : ${echecs.join(' | ')}`);
  (globalThis as unknown as { process: { exitCode: number } }).process.exitCode = 1;
} else {
  console.log(`${total} cas sur ${total} passent.`);
}
