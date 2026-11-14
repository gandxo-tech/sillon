import type { Previsions, Projection } from '../api/sources';

const fr = (v: number, d = 0) =>
  Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

export function PrevisionsBloc({ data }: { data: Previsions }) {
  const max = Math.max(...data.jours.map((j) => j.pluie), 5);

  return (
    <div className="horizon">
      <div className="horizon-tete">
        <div>
          <h4>Les 14 prochains jours</h4>
          <p>
            Prévision météo réelle pour ce point : pluie attendue, gel et demande évaporative. C’est
            la fenêtre où se décident un semis, une fauche ou un tour d’irrigation.
          </p>
        </div>
        <span className="horizon-source">Open-Meteo · maillage 1–11 km</span>
      </div>

      <div className="previsions-chiffres">
        <div>
          <span>Pluie cumulée</span>
          <strong>{fr(data.cumulPluie, 1)} mm</strong>
        </div>
        <div>
          <span>Demande ET0</span>
          <strong>{fr(data.cumulEt0, 1)} mm</strong>
        </div>
        <div>
          <span>Déficit</span>
          <strong>{data.deficit > 0 ? `${fr(data.deficit, 1)} mm` : 'couvert'}</strong>
        </div>
        <div>
          <span>Jours de gel</span>
          <strong>{data.joursGel}</strong>
        </div>
      </div>

      <div className="previsions-barres" aria-hidden="true">
        {data.jours.map((j) => (
          <div className="prevision-col" key={j.date}>
            <div className="prevision-piste">
              <span
                style={{ height: `${Math.max(2, (j.pluie / max) * 100)}%` }}
                className={j.pluie >= 5 ? 'pluie-forte' : undefined}
              />
            </div>
            <em>{j.pluie >= 0.5 ? fr(j.pluie) : '·'}</em>
            <small>{j.label}</small>
          </div>
        ))}
      </div>

      <p className="horizon-lecture">
        {data.prochainePluie
          ? `Première pluie utile (≥ 5 mm) le ${data.prochainePluie.label}, ${fr(
              data.prochainePluie.mm,
              1,
            )} mm.`
          : 'Aucune pluie de 5 mm ou plus dans les 14 jours : la réserve du sol fait tout le travail.'}
        {data.joursGel > 0 &&
          ` ${data.joursGel} jour${data.joursGel > 1 ? 's' : ''} sous 0 °C : à éviter pour un semis ou une culture sensible.`}
        {data.joursChauds > 0 &&
          ` ${data.joursChauds} jour${data.joursChauds > 1 ? 's' : ''} au-dessus de 30 °C, à surveiller en floraison.`}
      </p>
    </div>
  );
}

export function ProjectionBloc({ data }: { data: Projection }) {
  const modele = data.modele.replace(/_/g, '-');
  return (
    <div className="horizon horizon-projection">
      <div className="horizon-tete">
        <div>
          <h4>Projection climatique 2045–2049</h4>
          <p>
            Delta réel calculé pour ce point par un modèle CMIP6, entre 1995–1999 et 2045–2049.
            C’est cette condition qui apparaît dans le comparateur, à la place d’un scénario
            arbitraire.
          </p>
        </div>
        <span className="horizon-source">CMIP6 · {modele}</span>
      </div>

      <div className="projection-chiffres">
        <div>
          <span>Température moyenne</span>
          <strong className={data.deltaT >= 0 ? 'delta-chaud' : undefined}>
            {data.deltaT >= 0 ? '+' : '−'}
            {fr(Math.abs(data.deltaT), 1)} °C
          </strong>
        </div>
        <div>
          <span>Pluie annuelle</span>
          <strong className={data.deltaP < 0 ? 'delta-sec' : undefined}>
            {data.deltaP >= 0 ? '+' : '−'}
            {fr(Math.abs(data.deltaP))} %
          </strong>
        </div>
        <div>
          <span>Pluie annuelle projetée</span>
          <strong>{fr(data.futPluie)} mm</strong>
        </div>
      </div>

      <p className="horizon-lecture">
        La demande évaporative est recalculée à +4,5 % par degré, faute d’ET0 dans ce jeu de
        projections. Un seul modèle ne fait pas une prévision : il donne une direction.
      </p>
    </div>
  );
}
