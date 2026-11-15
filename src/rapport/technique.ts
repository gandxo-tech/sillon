/**
 * Bloc 8 — partie technique repliée.
 *
 * C'est le seul endroit du rapport où le vocabulaire savant est autorisé :
 * ET0, RUSLE, déficit hydrique, azote. Il est masqué par défaut et ne sert
 * qu'à vérifier ou à contester le calcul.
 */

import { nombre } from '../moteur/des';
import type { SortieMoteur } from '../moteur/moteur';

export function paragraphesTechniques(sortie: SortieMoteur): string[] {
  const ponderations = [
    `eau ${nombre(sortie.poids.eau * 100)} %`,
    `sol ${nombre(sortie.poids.sol * 100)} %`,
    `revenu ${nombre(sortie.poids.revenu * 100)} %`,
    `sécurité ${nombre(sortie.poids.securite * 100)} %`,
    `intrants ${nombre(sortie.poids.intrants * 100)} %`,
    `travail ${nombre(sortie.poids.travail * 100)} %`,
  ].join(', ');

  const stabilite =
    sortie.verifications
      .map((v) => `${v.pluiePct} % de pluie → ${nombre(v.premier, 1)} / ${nombre(v.troisieme, 1)}`)
      .join(' ; ') || 'non disponible';

  const lignes = [
    `Le moteur a examiné ${sortie.nombreCandidats} rotations possibles et en a écarté ${sortie.rejets.length} des plus proches de la vôtre.`,
    `Pondération appliquée, normalisée à 1 : ${ponderations}.`,
    `Le bilan hydrique part de l’ET0 de saison et du coefficient cultural de chaque plante. L’érosion est estimée par RUSLE à partir de la pluie annuelle, de la texture, de la pente mesurée et de la couverture.`,
    `Le revenu part des marges brutes de la base, converties en FCFA (1 € = 655,957 FCFA), moins l’azote acheté (650 FCFA par kg), plus la prime légumineuse, moins la perte de rendement due à la terre qui s’en va.`,
    `Le déficit hydrique affiché est la différence entre la demande évaporative et l’eau disponible ; le seuil de rejet est fixé à 55 % de la demande, et 32 % reste un signal.`,
    `Test de stabilité : ${stabilite}.`,
    `Cycles : une culture doit tenir dans la saison ; pour une céréale et sa couverture semées ensemble, c’est le cumul qui est comparé à la saison plus 15 jours.`,
  ];

  /* Aucune succession retenue avec ses seules cultures : on le dit, au lieu de
     glisser des cultures qu'il ne possède pas sans prévenir. */
  if (sortie.poolElargi) {
    lignes.push(
      'Vos cultures, seules, ne donnaient aucune succession retenue : la recherche a été élargie à la base de référence. Les cultures que vous n’avez pas déclarées sont donc proposées, à titre de comparaison.',
    );
  }

  return lignes;
}

/** La source d’ET0 réellement utilisée, pour ne pas laisser croire à une mesure. */
export function sourceDemandeAir(sourceEt0: string): string {
  return `Demande évaporative de référence : ${sourceEt0}.`;
}
