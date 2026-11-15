/**
 * Base culturale de Sillon.
 *
 * Les onze cultures d'origine gardent leurs clés et leurs valeurs : les autres
 * modules (calendrier, eau, érosion, tableaux) les lisent telles quelles.
 * Les champs ajoutés servent au moteur de décision : travail, trésorerie,
 * débouché, calories et grande famille agronomique.
 *
 * `marge` reste en euros par hectare, comme avant (ordre de grandeur de
 * comparaison, pas une promesse de revenu). Les coûts d'intrant sont donnés
 * en FCFA par hectare, la monnaie dans laquelle un agriculteur ouest-africain
 * achète réellement son sac d'engrais.
 */

export interface Culture {
  id: string;
  nom: string;
  court: string;
  /** Pictogramme : permet de reconnaître la culture sans lire. */
  picto: string;
  /** Teinte de la pastille, pour distinguer les cultures d'un coup d'œil. */
  teinte: string;
  /** Famille botanique (clé historique, conservée telle quelle). */
  famille: string;
  /** Coefficient cultural moyen sur la saison. */
  kc: number;
  /** Part de la saison de croissance réellement occupée. */
  partSaison: number;
  /** Jours de croissance nécessaires dans la saison. */
  besoinJours: number;
  azoteDemande: number;
  azoteFixe: number;
  residus: number;
  couverture: number;
  facteurC: number;
  /** Marge brute indicative, €/ha — ordre de grandeur à remplacer par vos prix. */
  marge: number;
  toleranceSecheresse: number;
  /** Part de la réserve utile du sol que la culture peut réellement mobiliser. */
  facteurReserve: number;
  retour: number;
  /** Culture pluriannuelle : les années consécutives forment un seul stand. */
  perenne?: boolean;
  phMin: number;
  phMax: number;

  /* --- Champs ajoutés pour le moteur de décision --- */

  /** Jours de main-d'œuvre par hectare sur tout le cycle. */
  travailJoursHa: number;
  /** Coût des intrants achetés, FCFA par hectare (semence, engrais, protection). */
  coutIntrantFcfaHa: number;
  /** Où part la récolte : cheptel, marché, ou d'abord la marmite. */
  marche: 'eleveur' | 'marche' | 'autoconsommation';
  /** Énergie alimentaire produite par hectare, en Mcal (récolte moyenne). */
  caloriesMcalHa: number;
  /** Grande famille agronomique, utilisée par le moteur pour classer les successions. */
  typeCulture: 'cereale' | 'legumineuse' | 'tubercule' | 'couvert' | 'fourragere';
  /** Origine de la valeur : mesure connue, ou estimation assumée. */
  source?: 'mesure' | 'estime';
}

export const CULTURES: Record<string, Culture> = {
  mais: {
    id: 'mais', nom: 'Maïs grain', court: 'Maïs', picto: 'M', teinte: '#fff200', famille: 'Poacée',
    kc: 1.0, partSaison: 0.85, besoinJours: 130, azoteDemande: 175, azoteFixe: 0,
    residus: 5.2, couverture: 0.62, facteurC: 0.3, marge: 850, toleranceSecheresse: 0.34, facteurReserve: 1.0, retour: 2, phMin: 5.8, phMax: 7.6,
    travailJoursHa: 45, coutIntrantFcfaHa: 145000, marche: 'marche', caloriesMcalHa: 7300, typeCulture: 'cereale', source: 'mesure',
  },
  soja: {
    id: 'soja', nom: 'Soja', court: 'Soja', picto: 'S', teinte: '#0018ff', famille: 'Fabacée',
    kc: 0.92, partSaison: 0.8, besoinJours: 125, azoteDemande: 35, azoteFixe: 105,
    residus: 3.1, couverture: 0.78, facteurC: 0.22, marge: 700, toleranceSecheresse: 0.45, facteurReserve: 1.0, retour: 3, phMin: 6.0, phMax: 7.5,
    travailJoursHa: 40, coutIntrantFcfaHa: 95000, marche: 'marche', caloriesMcalHa: 2400, typeCulture: 'legumineuse', source: 'mesure',
  },
  ble: {
    id: 'ble', nom: 'Blé tendre d’hiver', court: 'Blé', picto: 'B', teinte: '#8b96f5', famille: 'Poacée',
    kc: 0.72, partSaison: 0.62, besoinJours: 110, azoteDemande: 115, azoteFixe: 0,
    residus: 3.6, couverture: 0.86, facteurC: 0.14, marge: 520, toleranceSecheresse: 0.55, facteurReserve: 1.15, retour: 3, phMin: 5.5, phMax: 7.8,
    travailJoursHa: 35, coutIntrantFcfaHa: 85000, marche: 'marche', caloriesMcalHa: 3300, typeCulture: 'cereale', source: 'mesure',
  },
  sorgho: {
    id: 'sorgho', nom: 'Sorgho grain', court: 'Sorgho', picto: 'R', teinte: '#000b5c', famille: 'Poacée',
    kc: 0.82, partSaison: 0.78, besoinJours: 115, azoteDemande: 105, azoteFixe: 0,
    residus: 4.1, couverture: 0.6, facteurC: 0.26, marge: 560, toleranceSecheresse: 0.85, facteurReserve: 1.35, retour: 3, phMin: 5.5, phMax: 8.2,
    travailJoursHa: 32, coutIntrantFcfaHa: 55000, marche: 'marche', caloriesMcalHa: 3400, typeCulture: 'cereale', source: 'mesure',
  },
  couvert: {
    id: 'couvert', nom: 'Couvert seigle / vesce', court: 'Couvert', picto: 'C', teinte: '#7f8ccc', famille: 'Mixte',
    kc: 0.35, partSaison: 0.35, besoinJours: 60, azoteDemande: 0, azoteFixe: 45,
    residus: 2.6, couverture: 1, facteurC: 0.05, marge: -140, toleranceSecheresse: 0.9, facteurReserve: 0.7, retour: 1, phMin: 4.8, phMax: 8.4,
    travailJoursHa: 12, coutIntrantFcfaHa: 25000, marche: 'autoconsommation', caloriesMcalHa: 0, typeCulture: 'couvert', source: 'mesure',
  },
  luzerne: {
    id: 'luzerne', nom: 'Luzerne (3 ans)', court: 'Luzerne', picto: 'L', teinte: '#3346ff', famille: 'Fabacée',
    kc: 0.95, partSaison: 1, besoinJours: 120, azoteDemande: 25, azoteFixe: 190,
    residus: 4.2, couverture: 0.95, facteurC: 0.08, marge: 600, toleranceSecheresse: 0.72, facteurReserve: 1.7, retour: 4, perenne: true, phMin: 6.2, phMax: 8.0,
    travailJoursHa: 55, coutIntrantFcfaHa: 130000, marche: 'eleveur', caloriesMcalHa: 2800, typeCulture: 'fourragere', source: 'mesure',
  },
  pois: {
    id: 'pois', nom: 'Pois protéagineux', court: 'Pois', picto: 'P', teinte: '#5a67c9', famille: 'Fabacée',
    kc: 0.78, partSaison: 0.6, besoinJours: 100, azoteDemande: 20, azoteFixe: 85,
    residus: 2.2, couverture: 0.72, facteurC: 0.18, marge: 480, toleranceSecheresse: 0.5, facteurReserve: 0.9, retour: 4, phMin: 6.0, phMax: 7.8,
    travailJoursHa: 38, coutIntrantFcfaHa: 70000, marche: 'marche', caloriesMcalHa: 1800, typeCulture: 'legumineuse', source: 'mesure',
  },
  manioc: {
    id: 'manioc', nom: 'Manioc', court: 'Manioc', picto: 'M', teinte: '#3346ff', famille: 'Euphorbiacée',
    kc: 0.6, partSaison: 0.9, besoinJours: 300, azoteDemande: 80, azoteFixe: 0,
    residus: 4.0, couverture: 0.8, facteurC: 0.15, marge: 500, toleranceSecheresse: 0.8, facteurReserve: 1.2, retour: 3, phMin: 5.0, phMax: 7.5,
    travailJoursHa: 60, coutIntrantFcfaHa: 60000, marche: 'autoconsommation', caloriesMcalHa: 4200, typeCulture: 'tubercule', source: 'mesure',
  },
  niebe: {
    id: 'niebe', nom: 'Niébé', court: 'Niébé', picto: 'N', teinte: '#0018ff', famille: 'Fabacée',
    kc: 0.75, partSaison: 0.5, besoinJours: 75, azoteDemande: 20, azoteFixe: 70,
    residus: 2.0, couverture: 0.6, facteurC: 0.2, marge: 350, toleranceSecheresse: 0.7, facteurReserve: 0.8, retour: 2, phMin: 5.5, phMax: 7.0,
    travailJoursHa: 28, coutIntrantFcfaHa: 30000, marche: 'autoconsommation', caloriesMcalHa: 1300, typeCulture: 'legumineuse', source: 'mesure',
  },
  arachide: {
    id: 'arachide', nom: 'Arachide', court: 'Arachide', picto: 'A', teinte: '#fff200', famille: 'Fabacée',
    kc: 0.7, partSaison: 0.6, besoinJours: 110, azoteDemande: 30, azoteFixe: 60,
    residus: 2.5, couverture: 0.7, facteurC: 0.22, marge: 400, toleranceSecheresse: 0.65, facteurReserve: 0.9, retour: 3, phMin: 5.5, phMax: 7.0,
    travailJoursHa: 42, coutIntrantFcfaHa: 55000, marche: 'marche', caloriesMcalHa: 2600, typeCulture: 'legumineuse', source: 'mesure',
  },
  igname: {
    id: 'igname', nom: 'Igname', court: 'Igname', picto: 'I', teinte: '#8b96f5', famille: 'Dioscoréacée',
    kc: 0.85, partSaison: 0.8, besoinJours: 270, azoteDemande: 100, azoteFixe: 0,
    residus: 3.5, couverture: 0.75, facteurC: 0.18, marge: 700, toleranceSecheresse: 0.6, facteurReserve: 1.1, retour: 3, phMin: 5.5, phMax: 7.0,
    travailJoursHa: 80, coutIntrantFcfaHa: 120000, marche: 'marche', caloriesMcalHa: 3800, typeCulture: 'tubercule', source: 'mesure',
  },

  /* --- Douze cultures ajoutées : valeurs calées sur les cultures proches --- */

  mil: {
    id: 'mil', nom: 'Mil', court: 'Mil', picto: 'm', teinte: '#d9c46a', famille: 'Poacée',
    kc: 0.78, partSaison: 0.7, besoinJours: 95, azoteDemande: 80, azoteFixe: 0,
    residus: 3.0, couverture: 0.55, facteurC: 0.28, marge: 380, toleranceSecheresse: 0.92, facteurReserve: 1.4, retour: 3, phMin: 5.0, phMax: 7.8,
    travailJoursHa: 30, coutIntrantFcfaHa: 45000, marche: 'autoconsommation', caloriesMcalHa: 3400, typeCulture: 'cereale', source: 'estime',
  },
  petit_mil: {
    id: 'petit_mil', nom: 'Petit mil précoce', court: 'Petit mil', picto: 'p', teinte: '#e0cf8a', famille: 'Poacée',
    kc: 0.72, partSaison: 0.6, besoinJours: 75, azoteDemande: 60, azoteFixe: 0,
    residus: 2.4, couverture: 0.5, facteurC: 0.26, marge: 320, toleranceSecheresse: 0.95, facteurReserve: 1.3, retour: 3, phMin: 5.0, phMax: 7.8,
    travailJoursHa: 26, coutIntrantFcfaHa: 35000, marche: 'autoconsommation', caloriesMcalHa: 2900, typeCulture: 'cereale', source: 'estime',
  },
  fonio: {
    id: 'fonio', nom: 'Fonio', court: 'Fonio', picto: 'f', teinte: '#cbb87a', famille: 'Poacée',
    kc: 0.7, partSaison: 0.62, besoinJours: 80, azoteDemande: 45, azoteFixe: 0,
    residus: 1.8, couverture: 0.45, facteurC: 0.2, marge: 300, toleranceSecheresse: 0.95, facteurReserve: 1.2, retour: 2, phMin: 4.8, phMax: 7.2,
    travailJoursHa: 25, coutIntrantFcfaHa: 25000, marche: 'autoconsommation', caloriesMcalHa: 3200, typeCulture: 'cereale', source: 'estime',
  },
  haricot: {
    id: 'haricot', nom: 'Haricot', court: 'Haricot', picto: 'h', teinte: '#9c5a3c', famille: 'Fabacée',
    kc: 0.8, partSaison: 0.6, besoinJours: 85, azoteDemande: 25, azoteFixe: 55,
    residus: 1.8, couverture: 0.65, facteurC: 0.2, marge: 420, toleranceSecheresse: 0.55, facteurReserve: 0.9, retour: 3, phMin: 5.5, phMax: 7.5,
    travailJoursHa: 40, coutIntrantFcfaHa: 50000, marche: 'marche', caloriesMcalHa: 1200, typeCulture: 'legumineuse', source: 'estime',
  },
  dolique: {
    id: 'dolique', nom: 'Dolique', court: 'Dolique', picto: 'd', teinte: '#8a7ad0', famille: 'Fabacée',
    kc: 0.72, partSaison: 0.5, besoinJours: 95, azoteDemande: 20, azoteFixe: 55,
    residus: 2.0, couverture: 0.65, facteurC: 0.2, marge: 320, toleranceSecheresse: 0.75, facteurReserve: 0.9, retour: 2, phMin: 5.2, phMax: 7.2,
    travailJoursHa: 32, coutIntrantFcfaHa: 32000, marche: 'autoconsommation', caloriesMcalHa: 1150, typeCulture: 'legumineuse', source: 'estime',
  },
  mucuna: {
    id: 'mucuna', nom: 'Mucuna (couverture)', court: 'Mucuna', picto: 'u', teinte: '#4f7a4a', famille: 'Fabacée',
    kc: 0.6, partSaison: 0.5, besoinJours: 90, azoteDemande: 0, azoteFixe: 90,
    residus: 3.2, couverture: 1, facteurC: 0.03, marge: -120, toleranceSecheresse: 0.85, facteurReserve: 0.9, retour: 1, phMin: 5.0, phMax: 7.5,
    travailJoursHa: 15, coutIntrantFcfaHa: 30000, marche: 'autoconsommation', caloriesMcalHa: 0, typeCulture: 'couvert', source: 'estime',
  },
  crotalaire: {
    id: 'crotalaire', nom: 'Crotalaire (couverture)', court: 'Crotalaire', picto: 'k', teinte: '#5f8f57', famille: 'Fabacée',
    kc: 0.58, partSaison: 0.5, besoinJours: 85, azoteDemande: 0, azoteFixe: 95,
    residus: 3.0, couverture: 1, facteurC: 0.03, marge: -110, toleranceSecheresse: 0.8, facteurReserve: 0.85, retour: 1, phMin: 5.0, phMax: 7.6,
    travailJoursHa: 16, coutIntrantFcfaHa: 28000, marche: 'autoconsommation', caloriesMcalHa: 0, typeCulture: 'couvert', source: 'estime',
  },
  patate_douce: {
    id: 'patate_douce', nom: 'Patate douce', court: 'Patate douce', picto: 'D', teinte: '#d98b3f', famille: 'Convolvulacée',
    kc: 0.9, partSaison: 0.75, besoinJours: 120, azoteDemande: 60, azoteFixe: 0,
    residus: 2.2, couverture: 0.85, facteurC: 0.12, marge: 650, toleranceSecheresse: 0.7, facteurReserve: 1.1, retour: 3, phMin: 5.2, phMax: 7.0,
    travailJoursHa: 70, coutIntrantFcfaHa: 90000, marche: 'marche', caloriesMcalHa: 2600, typeCulture: 'tubercule', source: 'estime',
  },
  taro: {
    id: 'taro', nom: 'Taro', court: 'Taro', picto: 't', teinte: '#6b8f4e', famille: 'Aracée',
    kc: 0.95, partSaison: 0.9, besoinJours: 210, azoteDemande: 90, azoteFixe: 0,
    residus: 2.0, couverture: 0.8, facteurC: 0.12, marge: 900, toleranceSecheresse: 0.5, facteurReserve: 1.2, retour: 3, phMin: 5.2, phMax: 6.8,
    travailJoursHa: 85, coutIntrantFcfaHa: 110000, marche: 'marche', caloriesMcalHa: 2400, typeCulture: 'tubercule', source: 'estime',
  },
  sesame: {
    id: 'sesame', nom: 'Sésame', court: 'Sésame', picto: 's', teinte: '#c2a35a', famille: 'Pédaliacée',
    kc: 0.75, partSaison: 0.62, besoinJours: 100, azoteDemande: 40, azoteFixe: 0,
    residus: 1.5, couverture: 0.5, facteurC: 0.2, marge: 550, toleranceSecheresse: 0.85, facteurReserve: 1.1, retour: 3, phMin: 5.4, phMax: 7.5,
    travailJoursHa: 40, coutIntrantFcfaHa: 40000, marche: 'marche', caloriesMcalHa: 1500, typeCulture: 'cereale', source: 'estime',
  },
  mais_court: {
    id: 'mais_court', nom: 'Maïs précoce', court: 'Maïs précoce', picto: 'µ', teinte: '#e8d94a', famille: 'Poacée',
    kc: 0.95, partSaison: 0.7, besoinJours: 90, azoteDemande: 140, azoteFixe: 0,
    residus: 4.2, couverture: 0.55, facteurC: 0.32, marge: 700, toleranceSecheresse: 0.45, facteurReserve: 0.95, retour: 2, phMin: 5.8, phMax: 7.6,
    travailJoursHa: 40, coutIntrantFcfaHa: 120000, marche: 'marche', caloriesMcalHa: 6000, typeCulture: 'cereale', source: 'estime',
  },
  brachiaria: {
    id: 'brachiaria', nom: 'Brachiaria (fourrage)', court: 'Brachiaria', picto: 'b', teinte: '#6f8f5f', famille: 'Poacée',
    kc: 0.9, partSaison: 0.85, besoinJours: 150, azoteDemande: 30, azoteFixe: 20,
    residus: 4.5, couverture: 1, facteurC: 0.04, marge: 350, toleranceSecheresse: 0.8, facteurReserve: 1.3, retour: 2, phMin: 5.0, phMax: 7.5,
    travailJoursHa: 20, coutIntrantFcfaHa: 35000, marche: 'eleveur', caloriesMcalHa: 0, typeCulture: 'fourragere', source: 'estime',
  },
};

export const CULTURES_LISTE = Object.values(CULTURES);

/** Prix de référence de l'azote, FCFA par kg N (urée 46 %, sac de 50 kg). */
export const PRIX_N_FCFA_KG = 650;

/** Taux de conversion utilisé partout pour lire les marges en FCFA. */
export const EURO_FCFA = 655.957;
