import type { ResultatRotation } from '../analyse/rotations';

interface Props {
  retenu: ResultatRotation;
  reference: ResultatRotation;
  condition: string;
}

export default function Verdict({ retenu, reference, condition }: Props) {
  const estLaVotre = retenu.def.id === reference.def.id;
  const ecart = Math.round(retenu.scoreGlobal - reference.scoreGlobal);
  const blocs = Math.round(retenu.scoreGlobal / 10);

  return (
    <div className={`verdict ${estLaVotre ? 'verdict-vous' : 'verdict-choix'}`}>
      <div className="verdict-icone" aria-hidden="true">
        {estLaVotre ? '✓' : '→'}
      </div>
      <div className="verdict-corps">
        <p className="verdict-etiquette">
          {estLaVotre ? 'Votre rotation se tient' : 'Le meilleur choix sur ce champ'}
        </p>
        <h4>{retenu.def.nom}</h4>

        <div className="verdict-cycle">
          {retenu.cultures.map((c, i) => (
            <span
              key={`${c.id}-${i}`}
              className="verdict-culture"
              style={{ '--teinte': c.teinte } as React.CSSProperties}
            >
              <span className="verdict-picto" aria-hidden="true">
                {c.picto}
              </span>
              <em>{c.court}</em>
            </span>
          ))}
        </div>

        <p className="verdict-phrase">
          {estLaVotre
            ? `Aucune des trois autres pistes ne fait mieux sous « ${condition} ».`
            : `${ecart > 0 ? `${ecart} points de mieux` : 'à égalité'} que ${reference.def.accroche.toLowerCase()}, sous « ${condition} ».`}
        </p>

        <div
          className="verdict-jauge"
          role="img"
          aria-label={`${Math.round(retenu.scoreGlobal)} points sur 100`}
        >
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={i < blocs ? 'plein' : ''} />
          ))}
          <strong>{Math.round(retenu.scoreGlobal)}</strong>
          <small>sur 100</small>
        </div>
      </div>
    </div>
  );
}
