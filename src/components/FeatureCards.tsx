import type { Profil } from '../analyse/features';

const fr = (v: number, d = 0) =>
  Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

interface Carte {
  cle: string;
  titre: string;
  valeur: string;
  unite?: string;
  detail: string;
  explication: string;
  source: string;
}

function construireCartes(p: Profil): Carte[] {
  const c = p.climat;
  const s = p.sol;
  const r = p.relief;

  return [
    {
      cle: 'climat',
      titre: 'Climat',
      valeur: c.zone,
      detail: `${fr(c.pluieAnnuelle)} mm/an · ${fr(c.tMoyenne, 1)} °C en moyenne · ${fr(c.tMoisChaud, 1)} °C au mois le plus chaud`,
      explication:
        'La combinaison pluie/température fixe la gamme de cultures possibles. L’indice d’aridité de ' +
        `${fr(c.aridite, 2)} situe ce point dans la famille « ${c.zone} ».`,
      source: `NASA POWER ${p.periode}`,
    },
    {
      cle: 'eau',
      titre: 'Bilan hydrique de saison',
      valeur: fr(c.deficitSaison),
      unite: 'mm de déficit',
      detail: `ET0 ${fr(c.et0Saison)} mm contre ${fr(c.pluieSaison)} mm de pluie`,
      explication:
        'Mesuré sur la demande évaporative de référence. Au-delà de 25 %, une culture peu tolérante perd du rendement sans irrigation — la comparaison des rotations chiffre ensuite le risque culture par culture.',
      source: c.sourceEt0,
    },
    {
      cle: 'saison',
      titre: 'Saison de croissance',
      valeur: fr(p.saison.duree),
      unite: 'jours sans gel',
      detail: p.saison.gelPrintanier
        ? `du ${p.saison.gelPrintanier} au ${p.saison.gelAutomnal}`
        : 'aucune gelée détectée sur la période',
      explication:
        'Un maïs a besoin d’environ 130 jours de croissance, un sorgho de 115 : la longueur de saison élimine ou autorise des cultures avant même de parler d’eau.',
      source: 'NASA POWER · températures minimales quotidiennes',
    },
    {
      cle: 'sol',
      titre: 'Sol',
      valeur: s.texture,
      detail: `${fr(s.argile)} % argile · pH ${fr(s.ph, 1)} · MO ${fr(s.mo, 1)} % · réserve ${fr(
        s.awcMm,
      )} mm${s.origine === 'mesure' ? '' : ' · texture estimée'}`,
      explication:
        (s.origine === 'mesure'
          ? `Mesures SoilGrids sur 0–60 cm. Un sol ${s.drainage} avec un facteur d’érodibilité K = ${fr(
              s.kErosion,
              2,
            )} : plus l’argile et le limon dominent, plus l’eau est retenue mais plus la battance et l’érosion guettent.`
          : s.origine === 'wrb'
            ? `SoilGrids ne fournit pas de propriétés à ce point : la texture est déduite de la classe mondiale ${s.wrb ?? 'inconnue'}. C’est un a priori pédologique, pas une mesure — une analyse de terre peut le contredire.`
            : 'Aucune donnée de sol exploitable ici : les valeurs affichées sont des valeurs médianes par défaut, à ne pas prendre pour une mesure.') ,
      source:
        s.origine === 'mesure'
          ? 'SoilGrids (ISRIC), 0–60 cm'
          : s.origine === 'wrb'
            ? `SoilGrids · classe WRB ${s.wrb ?? '—'}`
            : 'valeurs par défaut (sol non couvert)',
    },
    {
      cle: 'relief',
      titre: 'Relief',
      valeur: r.altitude !== null ? `${fr(r.altitude)} m` : 'non mesuré',
      unite: r.pente !== null ? `pente ${fr(r.pente, 1)} %` : undefined,
      detail:
        r.pente !== null
          ? `exposition ${r.exposition ?? '—'} · source ${r.source}`
          : 'relief indisponible pour ce point, pente supposée à 2 %',
      explication:
        'La pente multiplie le ruissellement et l’érosion. C’est elle qui rend une culture de couverture indispensable au lieu d’utile.',
      source: r.source,
    },
    {
      cle: 'risque',
      titre: 'Risques détectés',
      valeur: fr(p.risques.erosion, 1),
      unite: 't/ha/an d’érosion',
      detail: `stress hydrique ${fr(p.risques.stressHydrique * 100)} % · variabilité de la pluie ${fr(p.risques.variabilite)} %`,
      explication:
        `Érosion ${p.risques.erosion > 5 ? 'au-dessus' : 'en dessous'} du seuil agronomique de 5 t/ha/an. La variabilité de ${fr(p.risques.variabilite)} % mesure l’écart type des pluies annuelles : c’est le risque de l’année qui casse tout.`,
      source: 'RUSLE · NASA POWER · SRTM',
    },
  ];
}

export default function FeatureCards({ profil }: { profil: Profil }) {
  const cartes = construireCartes(profil);

  return (
    <div className="cartes">
      {cartes.map((carte) => (
        <article className="carte" key={carte.cle}>
          <div className="carte-tete">
            <span>{carte.titre}</span>
            <em>{carte.source}</em>
          </div>
          <p className="carte-valeur">
            {carte.valeur}
            {carte.unite && <span>{carte.unite}</span>}
          </p>
          <p className="carte-detail">{carte.detail}</p>
          <p className="carte-explication">{carte.explication}</p>
        </article>
      ))}
    </div>
  );
}
