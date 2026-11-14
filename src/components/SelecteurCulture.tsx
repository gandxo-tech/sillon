import { CULTURES, resoudreCulture } from '../analyse/rotations';

interface Props {
  actuelle: string;
  suivante: string;
  onChange: (champ: 'actuelle' | 'suivante', valeur: string) => void;
  compact?: boolean;
}

/** Affiche l'identifiant de la base, sinon le texte saisi tel quel. */
function texteAffiche(valeur: string): string {
  return CULTURES[valeur]?.nom ?? valeur;
}

export default function SelecteurCulture({ actuelle, suivante, onChange, compact }: Props) {
  return (
    <div className={`cultures${compact ? ' cultures-compact' : ''}`}>
      <div className="culture-saisies">
        <label className="culture-saisie">
          <span>Culture en place</span>
          <input
            type="text"
            value={texteAffiche(actuelle)}
            onChange={(e) => onChange('actuelle', e.target.value)}
            placeholder="maïs, soja, blé, tournesol…"
            autoComplete="off"
          />
        </label>

        <span className="culture-fleche" aria-hidden="true">
          vers
        </span>

        <label className="culture-saisie">
          <span>Culture envisagée ensuite</span>
          <input
            type="text"
            value={texteAffiche(suivante)}
            onChange={(e) => onChange('suivante', e.target.value)}
            placeholder="soja, blé, sorgho, couvert…"
            autoComplete="off"
          />
        </label>
      </div>
      <p className="culture-aide">
        Tapez le nom de la culture, dans votre langue si besoin. Une culture inconnue de la base
        reçoit des coefficients génériques, signalés dans le rapport.
      </p>
    </div>
  );
}
