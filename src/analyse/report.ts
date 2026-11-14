import type { Profil } from './features';
import type { Condition, ResultatRotation } from './rotations';

const fr = (v: number, d = 0) =>
  Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

export interface Rapport {
  parle: string;
  synthese: string[];
  sections: { titre: string; paragraphes: string[]; puces?: string[] }[];
  recommandation: {
    nom: string;
    accroche: string;
    score: number;
    raisons: string[];
    alertes: string[];
    alternatives: { nom: string; score: number; pourquoi: string }[];
  };
}

function qualifierDeficit(ratio: number): string {
  if (ratio < 0.08) return 'négligeable';
  if (ratio < 0.18) return 'modéré';
  if (ratio < 0.3) return 'marqué';
  return 'sévère';
}

function qualifierErosion(t: number): string {
  if (t < 2) return 'faible';
  if (t < 5) return 'contenue sous le seuil tolérable';
  if (t < 10) return 'supérieure au seuil tolérable';
  return 'très forte';
}

export function construireRapport(
  p: Profil,
  resultats: ResultatRotation[],
  condition: Condition,
): Rapport {
  const reference = resultats[0];
  const classement = [...resultats].sort((a, b) => b.scoreGlobal - a.scoreGlobal);
  const meilleur = classement[0];
  const viables = classement.filter((r) => r.viable);
  const retenu = viables[0] ?? meilleur;

  const c = p.climat;
  const s = p.sol;
  const r = p.relief;
  const saison = p.saison;

  const synthese = [
    `À ${p.lieu.nom}, la pluie atteint ${fr(c.pluieAnnuelle)} mm par an et la température moyenne ${fr(
      c.tMoyenne,
      1,
    )} °C : le climat détecté est ${c.zone}. La saison sans gel dure ${fr(saison.duree)} jours${
      saison.gelPrintanier ? `, du ${saison.gelPrintanier} au ${saison.gelAutomnal}` : ''
    }. Sur cette fenêtre, ${fr(c.pluieSaison)} mm de pluie tombent pour ${fr(
      c.et0Saison,
    )} mm de demande évaporative (${c.sourceEt0}).`,
    `Le déficit hydrique de saison ressort à ${fr(c.deficitSaison)} mm, soit ${fr(
      c.et0Saison > 0 ? (c.deficitSaison / c.et0Saison) * 100 : 0,
    )} % de la demande évaporative de référence : un stress ${qualifierDeficit(
      c.et0Saison > 0 ? c.deficitSaison / c.et0Saison : 0,
    )}. Le sol est ${s.texture} (${fr(s.argile)} % d’argile, pH ${fr(s.ph, 1)}, matière organique ${fr(
      s.mo,
      1,
    )} %, réserve utile ${fr(s.awcMm)} mm sur 60 cm, drainage ${s.drainage})${
      s.origine === 'mesure'
        ? ', mesuré par SoilGrids.'
        : s.origine === 'wrb'
          ? ` — texture déduite de la classe ${s.wrb ?? 'WRB'} faute de propriétés SoilGrids à ce point : à confirmer par une analyse de terre.`
          : ' — faute de données de sol exploitables, ces valeurs sont des médianes par défaut. À remplacer par une analyse de terre avant toute décision.'
    }`,
    `La rotation qui ressort est « ${retenu.def.nom} » avec ${fr(
      retenu.scoreGlobal,
    )} points sur 100, contre ${fr(reference.scoreGlobal)} pour votre rotation déclarée (${reference.def.accroche})${
      condition.id === 'actuel' ? '' : ` dans la condition « ${condition.nom} »`
    }.`,
  ];

  const sections: Rapport['sections'] = [];

  sections.push({
    titre: 'Ce que la localisation révèle',
    paragraphes: [
      `Ce diagnostic ne repose sur aucune saisie : il est déduit du point que vous avez donné. La pluie et les températures viennent de NASA POWER (${p.periode}, ${fr(
        c.pluieAnnuelle,
      )} mm/an en moyenne, variabilité interannuelle de ${fr(
        c.cvPluie,
      )} %). L’évapotranspiration de référence est celle d’ERA5 ; le déficit est la différence entre ce que l’atmosphère demande et ce que le ciel fournit.`,
      `Le relief est mesuré sur un kilomètre autour du point : ${
        r.altitude !== null ? `${fr(r.altitude)} m d’altitude` : 'altitude non disponible'
      }${
        r.pente !== null
          ? `, pente de ${fr(r.pente, 1)} % orientée ${r.exposition ?? '—'} — c’est cette pente, combinée à la texture, qui pilote le risque érosif`
          : ', pente non mesurée pour ce point'
      }.`,
    ],
    puces: [
      `Indice d’aridité de ${fr(c.aridite, 2)} (pluie annuelle ÷ demande évaporative annuelle).`,
      `${fr(c.joursChauds)} jours par saison dépassent 30 °C.`,
      `Tendance de la pluie annuelle : ${c.tendancePluie >= 0 ? '+' : ''}${fr(c.tendancePluie)} mm par décennie sur la période.`,
      `Humidité de surface moyenne : ${c.humiditeSol !== null ? `${fr(c.humiditeSol, 3)} m³/m³` : 'non disponible'}.`,
    ],
  });

  sections.push({
    titre: 'Ce que cela change pour la rotation',
    paragraphes: [
      `Avec ${fr(c.et0Saison)} mm de demande sur la saison, une culture qui occupe 85 % de la fenêtre et transpire à un coefficient de 1,0 réclame environ ${fr(
        c.et0Saison * 0.85,
      )} mm. La pluie utile n’en couvre qu’une partie : c’est le déficit de ${fr(
        c.deficitSaison,
      )} mm que le modèle répartit sur les cultures selon leur tolérance à la sécheresse.`,
      `Le sol ${s.texture} stocke ${fr(
        s.awcMm,
      )} mm d’eau disponible sur 60 cm ; cette réserve amortit les épisodes secs de 8 à 15 jours, mais pas une sécheresse de fin de cycle. Avec un facteur d’érodibilité K = ${fr(
        s.kErosion,
        2,
      )} et une pente de ${r.pente !== null ? `${fr(r.pente, 1)} %` : '2 % (valeur supposée)'}, l’érosion de la rotation actuelle est estimée à ${fr(
        reference.erosion,
        1,
      )} t/ha/an, ${qualifierErosion(reference.erosion)}.`,
      `Enfin la matière organique à ${fr(
        s.mo,
        1,
      )} % classe ce sol parmi les ${s.mo > 4 ? 'sols riches' : s.mo > 2.5 ? 'sols correctement pourvus' : 'sols à surveiller'}. Une rotation qui ramène plus de résidus et couvre l’hiver entretient cette réserve ; la vôtre la laisse ${reference.mo10 > 0.05 ? 'progresser lentement' : 'stable au mieux'}.`,
    ],
  });

  sections.push({
    titre: 'Comment lire la comparaison',
    paragraphes: [
      `Les quatre stratégies sont évaluées avec le même sol, la même pente et la même climatologie. Seuls changent la succession des cultures, leur demande en eau, leurs résidus et leur capacité à casser les cycles de ravageurs.`,
      condition.id === 'actuel'
        ? `Condition affichée : le climat observé sur ${p.periode}.`
        : `Condition affichée : ${condition.nom}. La pluie de saison est modifiée de ${fr(
            condition.pluiePct,
          )} % et la demande évaporative de ${fr(condition.tempDelta * 4.5, 1)} %.`,
      `Une stratégie marquée « contrainte » n’est pas impossible : elle suppose une décision que vous n’avez pas encore prise (irrigation, débouché, matériel). Le score est alors réduit de 35 %.`,
    ],
  });

  /* --- Recommandation --- */
  const raisons: string[] = [];
  if (retenu.def.id === reference.def.id) {
    raisons.push(
      `Votre rotation actuelle reste la mieux notée (${fr(retenu.scoreGlobal)} / 100) : dans ces conditions, changer coûterait plus qu’il ne rapporterait.`,
    );
    raisons.push(
      `Elle conserve ${fr(retenu.marge)} €/ha de marge indicative, avec une érosion de ${fr(retenu.erosion, 1)} t/ha/an.`,
    );
    raisons.push(
      'Le point de vigilance reste la couverture hivernale : sol nu de novembre à avril, précisément la période où tombent les pluies érosives.',
    );
  } else {
    if (retenu.erosion < reference.erosion * 0.9) {
      raisons.push(
        `Érosion ramenée de ${fr(reference.erosion, 1)} à ${fr(retenu.erosion, 1)} t/ha/an, soit ${fr(
          (1 - retenu.erosion / reference.erosion) * 100,
        )} % de moins.`,
      );
    }
    if (retenu.stress < reference.stress - 0.02) {
      raisons.push(
        `Déficit hydrique réduit de ${fr(reference.deficit)} à ${fr(retenu.deficit)} mm sur la saison.`,
      );
    }
    if (retenu.azote < reference.azote - 15) {
      raisons.push(
        `${fr(reference.azote - retenu.azote)} kg N/ha achetés en moins grâce aux légumineuses du cycle.`,
      );
    }
    if (retenu.mo10 > reference.mo10 + 0.03) {
      raisons.push(
        `Matière organique : ${retenu.mo10 >= 0 ? '+' : ''}${fr(retenu.mo10, 2)} point sur 10 ans, contre ${fr(
          reference.mo10,
          2,
        )} pour l’alternance actuelle.`,
      );
    }
    if (retenu.marge > reference.marge + 20) {
      raisons.push(`Marge indicative supérieure de ${fr(retenu.marge - reference.marge)} €/ha.`);
    }
    if (retenu.marge < reference.marge - 20) {
      raisons.push(
        `Marge indicative en retrait de ${fr(reference.marge - retenu.marge)} €/ha : le gain se paie sur le sol et sur l’eau, pas sur la récolte.`,
      );
    }
  }

  const alertes = [...retenu.blocages];
  if (retenu.def.id === 'legumineuse') {
    alertes.push('La luzerne suppose un débouché fourrage fiable dans un rayon de 40 km.');
  }
  alertes.push(
    'Les marges sont des ordres de grandeur européens : remplacez-les par vos prix et vos aides avant toute décision.',
  );

  const alternatives = classement
    .filter((x) => x.def.id !== retenu.def.id)
    .slice(0, 3)
    .map((x) => ({
      nom: x.def.nom,
      score: x.scoreGlobal,
      pourquoi:
        x.blocages[0] ??
        (x.marge > retenu.marge
          ? `Marge plus élevée de ${fr(x.marge - retenu.marge)} €/ha, mais ${fr(x.erosion, 1)} t/ha/an d’érosion.`
          : `Érosion de ${fr(x.erosion, 1)} t/ha/an et ${fr(x.azote)} kg N/ha à acheter.`),
    }));

  sections.push({
    titre: 'Ce que l’outil ne peut pas voir',
    paragraphes: [
      'La compaction réelle, les ravageurs présents chez le voisin, la qualité de vos semis, l’état du parc matériel, vos contrats et vos aides : rien de tout cela ne se lit depuis un satellite ou une base de sols mondiale.',
      'Le sol est décrit à 250 m de résolution : la parcelle est probablement plus hétérogène que ce chiffre. Une analyse de terre reste la seule mesure qui engage.',
    ],
  });

  const pourParler = (t: string) =>
    t
      .replace(/€\/ha/g, 'euros par hectare')
      .replace(/t\/ha\/an/g, 'tonnes par hectare et par an')
      .replace(/kg N\/ha/g, 'kilos d’azote par hectare')
      .replace(/\s*%/g, ' pour cent')
      .replace(/«|»/g, '');

  const parle = [
    `Rapport pour ${p.lieu.nom}.`,
    `Il tombe ${Math.round(c.pluieAnnuelle)} millimètres de pluie par an, et la saison sans gel dure ${Math.round(
      saison.duree,
    )} jours.`,
    `Le sol est ${s.texture}.`,
    `Votre rotation, ${reference.def.accroche}, obtient ${Math.round(reference.scoreGlobal)} points sur cent.`,
    retenu.def.id === reference.def.id
      ? 'C’est la meilleure des quatre sur ce champ.'
      : `La meilleure piste est ${retenu.def.nom}, avec ${Math.round(retenu.scoreGlobal)} points sur cent.`,
    retenu.def.id === reference.def.id ? '' : `Pourquoi : ${raisons.slice(0, 2).join(' ')}`,
    retenu.blocages[0] ? `Point de vigilance : ${retenu.blocages[0]}` : '',
    'Ceci est une aide à la décision, pas une prescription.',
  ]
    .filter(Boolean)
    .map(pourParler)
    .join(' ');

  return {
    parle,
    synthese,
    sections,
    recommandation: {
      nom: retenu.def.nom,
      accroche: retenu.def.accroche,
      score: retenu.scoreGlobal,
      raisons,
      alertes,
      alternatives,
    },
  };
}
