/**
 * Variantes de rédaction du rapport.
 *
 * Six formulations minimum par emplacement. Le choix est déterministe :
 * hash(parcelle, emplacement) % 6. Une même formulation ne peut pas servir
 * deux fois dans un même rapport : le sélecteur retient celles déjà écrites.
 *
 * Règles de langue tenues ici : phrases courtes, voix active, deuxième
 * personne du pluriel, aucun mot du lexique interdit.
 */

import { indexVariante, nombre } from '../moteur/des';

export interface Donnees {
  rotation: string;
  actuelle: string;
  moisSemis: string;
  moisRecolte: string;
  revenuFcfa: number;
  revenuActuelFcfa: number;
  ecartRevenuFcfa: number;
  ecartEauMm: number;
  deficitPct: number;
  saisonMm: number;
  erosionT: number;
  ecartErosionT: number;
  travailJours: number;
  ecartTravailJours: number;
  engraisNatureKg: number;
  score: number;
  scoreActuel: number;
  coutFcfa: number;
  partMaison: number;
  rang: number;
}

export type Emplacement =
  | 'verdictOui'
  | 'verdictConditionnel'
  | 'verdictNon'
  | 'raisonRevenu'
  | 'raisonEau'
  | 'raisonSol'
  | 'raisonSecurite'
  | 'raisonIntrants'
  | 'raisonTravail'
  | 'cout'
  | 'travail'
  | 'alerte';

type Formule = (d: Donnees) => string;

export const VARIANTES: Record<Emplacement, Formule[]> = {
  verdictOui: [
    (d) => `Oui. ${d.rotation} tient sur votre champ cette année.`,
    (d) => `Oui, vous pouvez y aller. ${d.rotation} est la plus sûre ici.`,
    (d) => `Oui, c’est jouable. Semez ${d.rotation} et gardez votre argent.`,
    (d) => `Oui. Rien ne bloque ${d.rotation} sur cette parcelle.`,
    (d) => `Oui. ${d.rotation} demande moins que ce que votre terre donne.`,
    (d) => `Oui, franchement. ${d.rotation} passe sans forcer.`,
  ],
  verdictConditionnel: [
    (d) => `Oui, mais sous conditions. ${d.rotation} tient si vous couvrez le manque d’eau.`,
    (d) => `Oui, à une condition : prévoyez de l’eau pour ${d.rotation}.`,
    (d) => `C’est possible. ${d.rotation} passe, mais gardez une réserve pour la mauvaise année.`,
    (d) => `Oui, avec un garde-fou. ${d.rotation} reste juste sur l’eau.`,
    (d) => `Oui, si vous acceptez un peu de risque. ${d.rotation} est la moins fragile.`,
    (d) => `Ça peut marcher. ${d.rotation} demande une surveillance de chaque instant.`,
  ],
  verdictNon: [
    (d) => `Pas cette année. Votre sol ne gardera pas assez d’eau pour ${d.rotation}.`,
    (d) => `Ça peut passer, mais vous prenez un risque que vous ne pouvez pas absorber.`,
    (d) => `Le compte n’y est pas : vous perdriez de l’argent avant de gagner autre chose.`,
    (d) => `Non, pas dans ces conditions. ${d.rotation} demande plus que ce que votre terre donne.`,
    (d) => `Mieux vaut attendre. ${d.rotation} ne tient pas sur ce champ aujourd’hui.`,
    (d) => `Je ne le conseille pas. Le manque d’eau mangerait la récolte de ${d.rotation}.`,
  ],
  raisonRevenu: [
    (d) => `Vous gagnez ${nombre(d.ecartRevenuFcfa)} FCFA par hectare de plus que maintenant.`,
    (d) => `L’argent reste chez vous : ${nombre(d.ecartRevenuFcfa)} FCFA par hectare en plus.`,
    (d) => `À la vente, vous encaissez ${nombre(d.ecartRevenuFcfa)} FCFA par hectare de plus.`,
    (d) => `Votre poche y gagne ${nombre(d.ecartRevenuFcfa)} FCFA par hectare.`,
    (d) => `C’est ${nombre(d.ecartRevenuFcfa)} FCFA par hectare de mieux que votre rotation actuelle.`,
    (d) => `La récolte rapporte ${nombre(d.ecartRevenuFcfa)} FCFA par hectare de plus.`,
  ],
  raisonEau: [
    (d) => `La plante aurait ${nombre(d.ecartEauMm)} mm de moins à boire sur la saison.`,
    (d) => `Elle réclame ${nombre(d.ecartEauMm)} mm d’eau en moins que ce que vous faites.`,
    (d) => `Vous économisez ${nombre(d.ecartEauMm)} mm d’eau, presque un mois de pluie.`,
    (d) => `La soif de l’air pèse moins : ${nombre(d.ecartEauMm)} mm en moins.`,
    (d) => `Il lui faut ${nombre(d.ecartEauMm)} mm de moins pour la même saison.`,
    (d) => `Avec ${nombre(d.ecartEauMm)} mm en moins, la mauvaise année passe mieux.`,
  ],
  raisonSol: [
    (d) => `La terre qui s’en va tombe à ${nombre(d.erosionT, 1)} tonnes par hectare et par an.`,
    (d) => `Vous perdez ${nombre(Math.abs(d.ecartErosionT), 1)} tonnes de terre en moins chaque année.`,
    (d) => `Le sol reste en place : ${nombre(d.erosionT, 1)} tonnes perdues seulement.`,
    (d) => `La couverture retient la terre : ${nombre(d.erosionT, 1)} tonnes par hectare et par an.`,
    (d) => `Votre terre descend moins vite, à ${nombre(d.erosionT, 1)} tonnes par hectare.`,
    (d) => `Les restes de la récolte protègent le sol, qui part à ${nombre(d.erosionT, 1)} tonnes.`,
  ],
  raisonSecurite: [
    (d) => `Vous remplissez le grenier : ${nombre(d.partMaison)} % de la récolte reste chez vous.`,
    (d) => `La maison mange d’abord : ${nombre(d.partMaison)} % de ce que vous produisez.`,
    (d) => `Vous vendez moins, mais vous mangez mieux : ${nombre(d.partMaison)} % pour la famille.`,
    (d) => `La marmite est couverte : ${nombre(d.partMaison)} % de la récolte ne se vend pas.`,
    (d) => `Le grenier se remplit avant le marché, avec ${nombre(d.partMaison)} % de la récolte.`,
    (d) => `Vous dépendez moins du marché : ${nombre(d.partMaison)} % de la récolte reste à la maison.`,
  ],
  raisonIntrants: [
    (d) => `Vous achetez moins d’engrais : ${nombre(d.engraisNatureKg)} kg par hectare viennent du sol.`,
    (d) => `La légumineuse travaille : ${nombre(d.engraisNatureKg)} kg d’engrais de la nature par hectare.`,
    (d) => `Votre dette d’engrais baisse de ${nombre(d.engraisNatureKg)} kg par hectare.`,
    (d) => `Le sol fabrique ${nombre(d.engraisNatureKg)} kg d’engrais de la nature par hectare.`,
    (d) => `Vous économisez ${nombre(d.engraisNatureKg)} kg d’engrais acheté par hectare.`,
    (d) => `Les légumineuses remplacent ${nombre(d.engraisNatureKg)} kg d’engrais par hectare.`,
  ],
  raisonTravail: [
    (d) => `Elle demande ${nombre(d.travailJours)} jours de travail par hectare, contre ${nombre(d.travailJours + d.ecartTravailJours)} aujourd’hui.`,
    (d) => `Vous économisez ${nombre(d.ecartTravailJours)} jours de main-d’œuvre par hectare.`,
    (d) => `Le champ réclame ${nombre(d.travailJours)} jours par hectare, moins que votre rotation.`,
    (d) => `Vous libérez ${nombre(d.ecartTravailJours)} jours pour le reste de l’exploitation.`,
    (d) => `Le calendrier se resserre : ${nombre(d.travailJours)} jours par hectare.`,
    (d) => `Avec ${nombre(d.travailJours)} jours par hectare, la famille suffit.`,
  ],
  cout: [
    (d) => `Il faut sortir ${nombre(d.coutFcfa)} FCFA par hectare avant la récolte.`,
    (d) => `Comptez ${nombre(d.coutFcfa)} FCFA d’intrants par hectare.`,
    (d) => `La campagne coûte ${nombre(d.coutFcfa)} FCFA par hectare, semence comprise.`,
    (d) => `Vous engagez ${nombre(d.coutFcfa)} FCFA par hectare au départ.`,
    (d) => `L’avance est de ${nombre(d.coutFcfa)} FCFA par hectare.`,
    (d) => `Il faut avancer ${nombre(d.coutFcfa)} FCFA par hectare pour les achats.`,
  ],
  travail: [
    (d) => `Elle occupe ${nombre(d.travailJours)} jours de main-d’œuvre par hectare.`,
    (d) => `Le champ demande ${nombre(d.travailJours)} jours de travail par hectare.`,
    (d) => `C’est ${nombre(d.travailJours)} jours de travail, ${nombre(Math.abs(d.ecartTravailJours))} de plus que maintenant.`,
    (d) => `Prévoyez ${nombre(d.travailJours)} jours par hectare pour tout mener.`,
    (d) => `La main-d’œuvre nécessaire monte à ${nombre(d.travailJours)} jours par hectare.`,
    (d) => `Vous passez ${nombre(d.travailJours)} jours par hectare sur ce champ.`,
  ],
  alerte: [
    (d) => `Il manquerait ${nombre(d.ecartEauMm)} mm d’eau, ${nombre(d.deficitPct)} % de la saison.`,
    (d) => `Sur une mauvaise année, le manque d’eau atteindrait ${nombre(d.deficitPct)} %.`,
    (d) => `Un tiers de la saison pourrait manquer : ${nombre(d.deficitPct)} %.`,
    (d) => `Si la pluie tombe mal, ${nombre(d.deficitPct)} % de l’eau manque.`,
    (d) => `Le risque est l’eau : ${nombre(d.deficitPct)} % de la demande.`,
    (d) => `Comptez ${nombre(d.deficitPct)} % de manque d’eau dans un mauvais été.`,
  ],
};

/**
 * Sélectionne une formulation inédite dans le rapport en cours.
 * Déterministe : même parcelle, même emplacement, même texte.
 */
export class SelecteurVariantes {
  private deja: Set<string> = new Set();

  constructor(private graine: number) {}

  choisir(emplacement: Emplacement, d: Donnees): string {
    const liste = VARIANTES[emplacement];
    const depart = indexVariante(this.graine, emplacement, liste.length);
    for (let i = 0; i < liste.length; i += 1) {
      const texte = liste[(depart + i) % liste.length](d);
      if (!this.deja.has(texte)) {
        this.deja.add(texte);
        return texte;
      }
    }
    return liste[depart](d);
  }
}
