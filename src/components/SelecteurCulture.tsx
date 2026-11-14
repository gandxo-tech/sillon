import { CULTURES, CULTURES_LISTE, resoudreCulture, type Culture } from '../analyse/rotations';

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

function Pastilles({
  legende,
  valeur,
  onChange,
}: {
  legende: string;
  valeur: string;
  onChange: (id: string) => void;
}) {
  const choisie = resoudreCulture(valeur).culture.id;

  return (
    <fieldset className="culture-groupe">
      <legend>{legende}</legend>
      <div className="culture-grille" role="radiogroup" aria-label={legende}>
        {CULTURES_LISTE.map((c: Culture) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={choisie === c.id}
            className={`culture-pastille${choisie === c.id ? ' est-choisie' : ''}`}
            style={{ '--teinte': c.teinte } as React.CSSProperties}
            onClick={() => onChange(c.id)}
            title={c.nom}
          >
            <span className="culture-picto" aria-hidden="true">
              {c.picto}
            </span>
            <span className="culture-nom">{c.court}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function SelecteurCulture({ actuelle, suivante, onChange, compact }: Props) {
  return (
    <div className={`cultures${compact ? ' cultures-compact' : ''}`}>
      <Pastilles legende="Aujourd’hui dans le champ" valeur={actuelle} onChange={(v) => onChange('actuelle', v)} />
      <span className="culture-fleche" aria-hidden="true">
        ↓
      </span>
      <Pastilles legende="Et ensuite" valeur={suivante} onChange={(v) => onChange('suivante', v)} />

      <div className="culture-saisies">
        <label className="culture-saisie">
          <span>Ou tapez la culture en place</span>
          <input
            type="text"
            value={texteAffiche(actuelle)}
            onChange={(e) => onChange('actuelle', e.target.value)}
            placeholder="tournesol, colza, prairie…"
            autoComplete="off"
            list="cultures-connues"
          />
        </label>

        <label className="culture-saisie">
          <span>et celle que vous voulez semer</span>
          <input
            type="text"
            value={texteAffiche(suivante)}
            onChange={(e) => onChange('suivante', e.target.value)}
            placeholder="tournesol, colza, prairie…"
            autoComplete="off"
            list="cultures-connues"
          />
        </label>

        <datalist id="cultures-connues">
          {CULTURES_LISTE.map((c) => (
            <option key={c.id} value={c.nom} />
          ))}
          <option value="Tournesol" />
          <option value="Colza" />
          <option value="Orge" />
          <option value="Prairie temporaire" />
        </datalist>
      </div>
    </div>
  );
}
