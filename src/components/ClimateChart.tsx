interface Props {
  mois: string[];
  pluie: number[];
  et0: number[];
  humidite: number[] | null;
  anneeHumidite: number | null;
}

const L = 44;
const R = 12;
const H = 250;
const PAD_T = 20;
const PAD_B = 26;

export default function ClimateChart({ mois, pluie, et0, humidite, anneeHumidite }: Props) {
  const largeur = 760;
  const innerW = largeur - L - R;
  const innerH = H - PAD_T - PAD_B;
  const max = Math.max(...pluie, ...et0, 40);
  const echelle = Math.ceil(max / 40) * 40;

  const x = (i: number) => L + (i + 0.5) * (innerW / mois.length);
  const y = (v: number) => PAD_T + innerH - (v / echelle) * innerH;
  const barre = (innerW / mois.length) * 0.42;

  const pointsEt0 = et0.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const tick = echelle / 4;

  return (
    <div className="graphique">
      <div className="graphique-entete">
        <div>
          <h3>Rythme annuel de l’eau</h3>
          <p>
            Moyennes mensuelles réelles : pluie (barres) et demande évaporative ET0 (courbe). L’écart
            entre les deux creuse le déficit de saison.
          </p>
        </div>
        <div className="graphique-legende">
          <span>
            <i className="pastille pastille-pluie" /> Pluie
          </span>
          <span>
            <i className="pastille pastille-et0" /> ET0
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${largeur} ${H}`} role="img" aria-label="Pluie et évapotranspiration mensuelles">
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <line
              x1={L}
              x2={largeur - R}
              y1={y(tick * k)}
              y2={y(tick * k)}
              stroke="#c9d0ff"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            <text x={L - 8} y={y(tick * k) + 4} textAnchor="end" className="axe">
              {Math.round(tick * k)}
            </text>
          </g>
        ))}

        {pluie.map((v, i) => (
          <rect
            key={mois[i]}
            x={x(i) - barre / 2}
            y={y(v)}
            width={barre}
            height={PAD_T + innerH - y(v)}
            fill="#0018ff"
            opacity="0.85"
            rx="1"
          />
        ))}

        <polyline points={pointsEt0} fill="none" stroke="#000b5c" strokeWidth="2" strokeLinejoin="round" />
        {et0.map((v, i) => (
          <circle key={mois[i]} cx={x(i)} cy={y(v)} r="3" fill="#ffffff" stroke="#000b5c" strokeWidth="2" />
        ))}

        {mois.map((m, i) => (
          <text key={m} x={x(i)} y={H - 8} textAnchor="middle" className="axe">
            {m}
          </text>
        ))}

        <text x={L} y={12} className="axe axe-fort">
          mm
        </text>
      </svg>

      {humidite && humidite.length > 0 && (
        <div className="humidite">
          <h4>
            Humidité du sol 0–7 cm, moyenne mensuelle {anneeHumidite ? `(${anneeHumidite})` : ''}
          </h4>
          <div className="humidite-barres">
            {humidite.map((v, i) => (
              <div className="humidite-colonne" key={mois[i] ?? i}>
                <div className="humidite-piste">
                  <span style={{ height: `${Math.min(100, (v / 0.45) * 100)}%` }} />
                </div>
                <em>{v.toFixed(2)}</em>
                <small>{mois[i]}</small>
              </div>
            ))}
          </div>
          <p className="humidite-note">
            Sous 0,20 m³/m³, la plante ferme ses stomates : c’est le seuil de stress hydrique de
            surface.
          </p>
        </div>
      )}
    </div>
  );
}
