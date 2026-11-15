/**
 * Tableau de répartition : quelle succession sort première, et combien de fois ?
 *
 * Aucune succession ne doit dépasser 3 occurrences sur 5, sinon le moteur a
 * changé de favori sans changer de nature.
 */

import { chercherRotations } from '../moteur';
import { CAS_TABLEAU } from './scenarios';

const comptes = new Map<string, number>();

for (const scenario of CAS_TABLEAU) {
  const sortie = chercherRotations(scenario.entree);
  const premier = sortie.meilleure;
  comptes.set(premier.nom, (comptes.get(premier.nom) ?? 0) + 1);
  console.log(`  ${scenario.nom.padEnd(46)} → ${premier.nom} (${premier.score.toFixed(1)})`);
}

console.log('');
console.log('Succession retenue en tête | Nombre de cas sur 5');
console.log('---------------------------|--------------------');
for (const [nom, n] of [...comptes.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${nom.padEnd(25)}| ${n}`);
}

const pire = [...comptes.entries()].sort((a, b) => b[1] - a[1])[0];
console.log('');
if (pire && pire[1] > 3) {
  console.error(`ÉCHEC : « ${pire[0]} » sort ${pire[1]} fois sur 5 (maximum 3).`);
  (globalThis as unknown as { process: { exitCode: number } }).process.exitCode = 1;
} else {
  console.log('Répartition conforme : aucune succession ne dépasse 3 cas sur 5.');
}
