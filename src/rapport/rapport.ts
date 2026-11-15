/**
 * Rapport paysan : huit blocs, dans l'ordre, en langage simple.
 *
 * Règles tenues ici :
 *  - phrases courtes, deuxième personne du pluriel, voix active ;
 *  - aucun mot technique avant le bloc 8 (replié) ;
 *  - chaque chiffre vient d'un calcul du moteur ou d'une source branchée ;
 *  - l'argent est en FCFA par hectare, toujours comparé à la rotation actuelle ;
 *  - les dates sont des mois, jamais des jours de l'année.
 */

import type { Profil } from '../analyse/features';
import { arrondi, nombre } from '../moteur/des';
import type { Critere, SortieMoteur } from '../moteur/moteur';
import { LIBELLES_CRITERE } from '../moteur/moteur';
import { paragraphesTechniques } from './technique';
import { SelecteurVariantes } from './variantes';
import type { Donnees } from './variantes';

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export type NiveauVerdict = 'oui' | 'conditionnel' | 'non';

export interface LigneTableau {
  libelle: string;
  /** Une valeur par colonne : votre rotation, puis les trois options. */
  valeurs: string[];
  lecture: string;
}

export interface EnteteComparaison {
  nom: string;
  suite: string;
  score: number;
}

export interface Comparaison {
  entetes: EnteteComparaison[];
  lignes: LigneTableau[];
}

export interface OptionAffichee {
  nom: string;
  suite: string;
  score: number;
  gagne: string;
  coute: string;
  meilleure: boolean;
}

export interface SourceAffichee {
  nom: string;
  etat: 'ok' | 'echec';
  variable: string;
  resolution: string;
  detail: string;
}

export type TypeBloc = 'verdict' | 'texte' | 'tableau' | 'options' | 'rejets' | 'technique';

export interface Bloc {
  numero: number;
  titre: string;
  type: TypeBloc;
  paragraphes: string[];
  puces?: string[];
  tableau?: Comparaison;
  options?: OptionAffichee[];
  rejets?: string[];
  sources?: SourceAffichee[];
  replie?: boolean;
}

export interface Rapport {
  verdict: { niveau: NiveauVerdict; badge: string; badgeCourt: string; phrase: string; rotation: string };
  blocs: Bloc[];
  parle: string;
  cles: string[];
}

/* ------------------------------------------------------------------ */
/* Petits formateurs                                                  */
/* ------------------------------------------------------------------ */

const fcfa = (v: number): string => {
  if (!Number.isFinite(v)) return 'non disponible';
  return nombre(Math.round(v / 5000) * 5000);
};
const mm = (v: number): string => (Number.isFinite(v) ? nombre(Math.round(v)) : 'non disponible');
const tonnes = (v: number): string => (Number.isFinite(v) ? nombre(arrondi(v, 1)) : 'non disponible');

function calendrier(p: Profil): { semis: string; recolte: string } {
  const pluies = p.graphique.pluie;
  if (!pluies.length) return { semis: 'à la première pluie utile', recolte: 'à la fin de la saison' };
  const max = Math.max(...pluies);
  const seuil = Math.max(20, max * 0.4);
  const debut = pluies.findIndex((v) => v >= seuil);
  const depart = debut >= 0 ? debut : pluies.indexOf(max);
  const dureeMois = Math.max(1, Math.round(p.saison.duree / 30));
  return {
    semis: MOIS[(depart + 12) % 12],
    recolte: MOIS[(depart + dureeMois - 1 + 12) % 12],
  };
}

const liste = (xs: string[]): string =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} et ${xs[xs.length - 1]}`;

/* ------------------------------------------------------------------ */
/* Construction                                                       */
/* ------------------------------------------------------------------ */

export function construireRapport(
  profil: Profil,
  sortie: SortieMoteur,
  actuelleNom: string,
): Rapport {
  const reference = sortie.reference;
  const meilleure = sortie.meilleure;
  const selecteur = new SelecteurVariantes(sortie.graine);
  const cal = calendrier(profil);

  const ecartRevenuFcfa = meilleure.metriques.revenuNetFcfa - reference.metriques.revenuNetFcfa;
  const ecartEauMm = reference.metriques.base.deficit - meilleure.metriques.base.deficit;
  const ecartTravailJours = meilleure.metriques.travailJoursHa - reference.metriques.travailJoursHa;
  const ecartErosionT = reference.metriques.base.erosion - meilleure.metriques.base.erosion;

  const donnees: Donnees = {
    rotation: meilleure.metriques.base.def.accroche,
    actuelle: actuelleNom,
    moisSemis: cal.semis,
    moisRecolte: cal.recolte,
    revenuFcfa: meilleure.metriques.revenuNetFcfa,
    revenuActuelFcfa: reference.metriques.revenuNetFcfa,
    ecartRevenuFcfa,
    ecartEauMm: Math.max(0, ecartEauMm),
    deficitPct: Math.round(meilleure.metriques.base.stress * 100),
    saisonMm: profil.climat.pluieSaison,
    erosionT: meilleure.metriques.base.erosion,
    ecartErosionT,
    travailJours: meilleure.metriques.travailJoursHa,
    ecartTravailJours,
    engraisNatureKg: Math.round(meilleure.metriques.azoteFixeMoyen),
    score: arrondi(meilleure.metriques.score, 1),
    scoreActuel: arrondi(reference.metriques.score, 1),
    coutFcfa: meilleure.metriques.coutIntrantFcfaHa,
    partMaison: Math.round(meilleure.metriques.partAutoconsommation * 100),
    rang: meilleure.rang,
  };

  /* --- Niveau du verdict --- */
  const eauTendue = meilleure.metriques.base.stress > 0.32;
  const estLaVotre = meilleure.id === 'utilisateur';
  const aucuneOption = sortie.classement.length === 0;
  const niveau: NiveauVerdict = aucuneOption
    ? 'non'
    : estLaVotre
      ? 'oui'
      : sortie.stabilite === 'fragile' || eauTendue || meilleure.alertes.length > 0
        ? 'conditionnel'
        : 'oui';

  const phraseVerdict = selecteur.choisir(
    niveau === 'oui' ? 'verdictOui' : niveau === 'conditionnel' ? 'verdictConditionnel' : 'verdictNon',
    donnees,
  );

  const verdict = {
    niveau,
    badge: niveau === 'oui' ? 'Oui' : niveau === 'conditionnel' ? 'Oui, sous conditions' : 'Non',
    // Le badge est un rond de 46 px : au-delà de quatre lettres, il déborde.
    badgeCourt: niveau === 'non' ? 'Non' : 'Oui',
    phrase: aucuneOption
      ? `Rien ne passe cette année sur ce champ. Il faut d’abord régler l’eau ou le budget.`
      : phraseVerdict,
    rotation: meilleure.metriques.base.def.accroche,
  };

  /* --- Bloc 2 : pourquoi, trois puces maximum --- */
  const pucesPourquoi: string[] = [];
  const criteresGagnants = meilleure.gagneSur.slice(0, 4) as Critere[];
  for (const critere of criteresGagnants) {
    // Un gain d'eau de quelques millimètres ne mérite pas d'être mis en avant.
    if (critere === 'eau' && ecartEauMm < 10) continue;
    if (pucesPourquoi.length >= 3) break;
    const emplacement =
      critere === 'revenu' ? 'raisonRevenu'
        : critere === 'eau' ? 'raisonEau'
          : critere === 'sol' ? 'raisonSol'
            : critere === 'securite' ? 'raisonSecurite'
              : critere === 'intrants' ? 'raisonIntrants'
                : 'raisonTravail';
    pucesPourquoi.push(selecteur.choisir(emplacement, donnees));
  }
  if (!pucesPourquoi.length) {
    pucesPourquoi.push(
      estLaVotre
        ? 'Votre rotation reste la mieux placée : changer coûterait plus qu’il ne rapporterait.'
        : `${meilleure.pourquoi} Le gain reste modeste sur ce champ.`,
    );
  }
  if (pucesPourquoi.length < 3) {
    pucesPourquoi.push(`Elle obtient ${nombre(donnees.score, 1)} points sur 100, contre ${nombre(donnees.scoreActuel, 1)} pour la vôtre.`);
  }
  if (pucesPourquoi.length < 3) {
    pucesPourquoi.push(`Vous semez en ${cal.semis} et vous récoltez en ${cal.recolte}.`);
  }

  /* --- Bloc 3 : ce que ça change, trois lignes, quatre colonnes --- */
  const troisOptions = sortie.classement.slice(0, 3);
  const autresGains = meilleure.gagneSur
    .filter((c) => c !== 'revenu')
    .map((c) => LIBELLES_CRITERE[c]);
  const comparaison: Comparaison = {
    entetes: [
      { nom: actuelleNom, suite: reference.metriques.base.def.accroche, score: arrondi(reference.metriques.score, 1) },
      ...troisOptions.map((c) => ({
        nom: c.nom,
        suite: c.metriques.base.def.accroche,
        score: arrondi(c.metriques.score, 1),
      })),
    ],
    lignes: [
      {
        libelle: 'Le travail',
        valeurs: [reference, ...troisOptions].map((c) => `${nombre(c.metriques.travailJoursHa)} jours par hectare`),
        lecture:
          ecartTravailJours > 0
            ? `Il faut ${nombre(Math.abs(ecartTravailJours))} jours de plus : prévoyez de l’aide.`
            : ecartTravailJours < 0
              ? `Vous libérez ${nombre(Math.abs(ecartTravailJours))} jours pour le reste.`
              : 'Même charge de travail que maintenant.',
      },
      {
        libelle: 'L’argent',
        valeurs: [reference, ...troisOptions].map((c) => `${fcfa(c.metriques.revenuNetFcfa)} FCFA par hectare`),
        lecture:
          Math.abs(ecartRevenuFcfa) < 5000
            ? 'Le revenu ne bouge pas : cherchez le gain ailleurs.'
            : ecartRevenuFcfa > 0
              ? `Vous gagnez ${fcfa(ecartRevenuFcfa)} FCFA par hectare.`
              : `Vous perdez ${fcfa(Math.abs(ecartRevenuFcfa))} FCFA par hectare${
                  autresGains.length ? `, mais vous gagnez sur ${liste(autresGains)}` : ', sans gain net ailleurs'
                }.`,
      },
      {
        libelle: 'L’eau',
        valeurs: [reference, ...troisOptions].map((c) => `${mm(c.metriques.base.deficit)} mm manquants`),
        lecture:
          ecartEauMm > 1
            ? `${mm(ecartEauMm)} mm de moins à trouver, ${nombre(Math.round((100 * ecartEauMm) / Math.max(1, profil.climat.pluieSaison)))} % de votre pluie de saison.`
            : 'La demande en eau ne baisse pas : c’est le point à surveiller.',
      },
    ],
  };

  /* --- Bloc 4 : les trois options classées --- */
  const options: OptionAffichee[] = troisOptions.map((c, i) => ({
    nom: c.nom,
    suite: c.metriques.base.def.accroche,
    score: arrondi(c.metriques.score, 1),
    gagne: c.gagneSur.length
      ? `Gagne sur ${liste(c.gagneSur.map((x) => LIBELLES_CRITERE[x]))}.`
      : 'Ne gagne nettement sur aucun critère.',
    coute: `${selecteur.choisir('cout', { ...donnees, coutFcfa: c.metriques.coutIntrantFcfaHa })} ${selecteur.choisir('travail', { ...donnees, travailJours: c.metriques.travailJoursHa })}`,
    meilleure: i === 0,
  }));

  /* --- Bloc 5 : si la saison tourne mal --- */
  const repli = sortie.replis[sortie.replis.length - 1];
  const manqueSupplementaire = Math.round(0.2 * profil.climat.pluieSaison * 0.85);
  const paragraphesMauvaiseSaison = [
    `Si la pluie tombe de ${nombre(20)} % en moins, ${mm(manqueSupplementaire)} mm disparaissent de votre saison.`,
    repli
      ? `Dans ce cas, ${repli.nom} reste la moins fragile, avec ${nombre(repli.score, 1)} points.`
      : 'Dans ce cas, aucune rotation ne se détache : gardez la plus courte.',
    `Semez en ${cal.semis}, dès que la pluie s’installe, et non avant.`,
    (() => {
      const tolerantes = meilleure.cultures
        .filter((c) => c.toleranceSecheresse >= 0.7)
        .map((c) => c.court);
      const noms = tolerantes.length ? tolerantes : [meilleure.cultures[0]?.court ?? 'la culture la plus tolérante'];
      return `Misez sur ${liste(noms)} : ${noms.length > 1 ? 'elles encaissent' : 'elle encaisse'} mieux la mauvaise année.`;
    })(),
    sortie.phraseStabilite ?? 'Le classement tient quand la pluie baisse : ce n’est pas un hasard.',
  ];

  /* --- Bloc 6 : les angles morts, quatre puces fixes --- */
  const inconnues = [
    'Le tassement du sol sous les roues et sous la charrue : l’outil ne le voit pas.',
    'Les insectes et les maladies qui arrivent du champ voisin : ils ne se lisent pas du ciel.',
    'La qualité de vos semis et la levée réelle : elle dépend du jour et de la main.',
    'Les contrats d’achat et les aides que vous pouvez obtenir : ils changent tout.',
    'Le sol est vu tous les 250 m, votre parcelle est plus mélangée que ça ; seule une analyse de terre tranche.',
  ];

  /* --- Bloc 7 : à vérifier sur le terrain --- */
  const verifications = [
    'Ouvrez une fosse de 60 cm : regardez la couleur et les racines avant de semer.',
    'Comptez les mauvaises herbes sur un mètre carré, à trois endroits du champ.',
    'Vérifiez que la semence est disponible et germe, avant de promettre une surface.',
    'Parlez à l’acheteur : prix, quantité, date. Sans accord, ne semez pas tout.',
  ];

  /* --- Bloc 8 : technique, replié --- */
  const rejetsTechniques = sortie.rejets.map((r) => `${r.phrase} [${r.code}]`);
  const sources: SourceAffichee[] = profil.sources.map((s) => ({
    nom: s.nom,
    etat: s.etat,
    variable: s.variable,
    resolution: s.resolution,
    detail: s.detail,
  }));

  const technique = paragraphesTechniques(sortie);

  /* --- Blocs, dans l'ordre --- */
  const blocs: Bloc[] = [
    {
      numero: 1,
      titre: 'La réponse',
      type: 'verdict',
      paragraphes: [verdict.phrase],
    },
    {
      numero: 2,
      titre: 'Pourquoi',
      type: 'texte',
      paragraphes: [],
      puces: pucesPourquoi.slice(0, 3),
    },
    {
      numero: 3,
      titre: 'Ce que ça change chez vous',
      type: 'tableau',
      paragraphes: [
        `Vous semez en ${cal.semis} et vous récoltez en ${cal.recolte}.`,
        estLaVotre
          ? 'Votre rotation reste la référence : les écarts sont donc nuls par construction.'
          : `Tout est comparé à votre rotation actuelle, ${actuelleNom}.`,
      ],
      tableau: comparaison,
    },
    {
      numero: 4,
      titre: 'Les trois options, classées',
      type: 'options',
      paragraphes: [
        `La meilleure est ${meilleure.nom}, avec ${nombre(donnees.score, 1)} points sur 100.`,
      ],
      options,
    },
    {
      numero: 0,
      titre: 'Ce que le moteur a écarté',
      type: 'rejets',
      paragraphes: [
        'Ces rotations ont été retirées avant le classement, pas pénalisées.',
      ],
      rejets: sortie.rejets.slice(0, 5).map((r) => r.phrase),
    },
    {
      numero: 5,
      titre: 'Si la saison tourne mal',
      type: 'texte',
      paragraphes: paragraphesMauvaiseSaison,
    },
    {
      numero: 6,
      titre: 'Ce que l’outil ne sait pas',
      type: 'texte',
      paragraphes: [
        'Quatre choses lui échappent complètement, et une limite de lecture s’y ajoute : elles peuvent décider de votre récolte.',
      ],
      puces: inconnues,
    },
    {
      numero: 7,
      titre: 'À vérifier sur le terrain',
      type: 'texte',
      paragraphes: ['Faites ces quatre gestes avant d’engager l’argent.'],
      puces: verifications,
    },
    {
      numero: 8,
      titre: 'Les sources et ce qui a échoué',
      type: 'technique',
      paragraphes: technique,
      puces: rejetsTechniques,
      sources,
      replie: true,
    },
  ];

  /* --- Résumé parlé --- */
  const parle = [
    `Rapport pour ${profil.lieu.nom}.`,
    `Votre rotation est ${actuelleNom}.`,
    verdict.phrase,
    `La meilleure option est ${meilleure.nom}, avec ${Math.round(donnees.score)} points sur cent.`,
    ecartRevenuFcfa > 5000
      ? `Elle rapporte ${Math.round(ecartRevenuFcfa / 1000) * 1000} francs par hectare de plus.`
      : ecartRevenuFcfa < -5000
        ? `Elle rapporte ${Math.round(Math.abs(ecartRevenuFcfa) / 1000) * 1000} francs de moins, avec moins d’achats à faire.`
        : 'Le gain d’argent est faible, le gain est ailleurs.',
    'Ceci est une aide à la décision, pas une prescription.',
  ].join(' ');

  const cles = [
    `Verdict : ${verdict.badge}. ${verdict.phrase}`,
    `Rotation conseillée : ${meilleure.nom} (${meilleure.metriques.base.def.accroche}), ${nombre(donnees.score, 1)} / 100.`,
    `Votre rotation : ${actuelleNom}, ${nombre(donnees.scoreActuel, 1)} / 100.`,
    `Revenu : ${fcfa(meilleure.metriques.revenuNetFcfa)} FCFA/ha contre ${fcfa(reference.metriques.revenuNetFcfa)} aujourd’hui.`,
    `Eau manquante : ${mm(meilleure.metriques.base.deficit)} mm sur la saison.`,
    `Travail : ${nombre(meilleure.metriques.travailJoursHa)} jours par hectare.`,
    `Semis en ${cal.semis}, récolte en ${cal.recolte}.`,
  ];

  return { verdict, blocs, parle, cles };
}
