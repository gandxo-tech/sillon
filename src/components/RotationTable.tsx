import type { Condition, ResultatRotation } from '../analyse/rotations';

const fr = (v: number, d = 0) =>
  Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

interface Props {
  resultats: ResultatRotation[];
  condition: Condition;
  conditions: Condition[];
  onCondition: (c: Condition) => void;
  meilleurId: string;
}

function Cellule({
  children,
  meilleur,
}: {
  children: React.ReactNode;
  meilleur: boolean;
}) {
  return <div className={`cellule${meilleur ? ' cellule-meilleure' : ''}`}>{children}</div>;
}

export default function RotationTable({
  resultats,
  condition,
  conditions,
  onCondition,
  meilleurId,
}: Props) {
  const reference = resultats[0];

  return (
    <div className="comparateur">
      <div className="conditions" role="group" aria-label="Condition climatique testée">
        <span className="conditions-label">Tester sous</span>
        {conditions.map((c) => (
          <button
            key={c.id}
            type="button"
            className={condition.id === c.id ? 'est-actif' : ''}
            aria-pressed={condition.id === c.id}
            onClick={() => onCondition(c)}
          >
            {c.nom}
          </button>
        ))}
      </div>

      <div className="table-rotations">
        <div className="ligne ligne-tete">
          <div className="etiquette">
            <strong>Indicateur</strong>
            <span>moyenne annuelle du cycle</span>
          </div>
          {resultats.map((r) => (
            <Cellule key={r.def.id} meilleur={r.def.id === meilleurId}>
              <span className="role">{r.def.role}</span>
              <h4>{r.def.nom}</h4>
              <p className="cycle">{r.cultures.map((c) => c.court).join(' › ')}</p>
              {!r.viable && <span className="badge-blocage">contrainte</span>}
            </Cellule>
          ))}
        </div>

        <div className="ligne">
          <div className="etiquette">
            <strong>Score global</strong>
            <span>eau, sol, revenu, résilience</span>
          </div>
          {resultats.map((r) => (
            <Cellule key={r.def.id} meilleur={r.def.id === meilleurId}>
              <span className="score">{fr(r.scoreGlobal)}</span>
              <span className="piste">
                <i style={{ width: `${r.scoreGlobal}%` }} />
              </span>
              <span className={r.scoreGlobal >= reference.scoreGlobal ? 'ecart ecart-bon' : 'ecart ecart-mauvais'}>
                {r.def.id === reference.def.id
                  ? 'référence'
                  : `${r.scoreGlobal >= reference.scoreGlobal ? '+' : '−'}${fr(Math.abs(r.scoreGlobal - reference.scoreGlobal))} pts`}
              </span>
            </Cellule>
          ))}
        </div>

        <div className="ligne">
          <div className="etiquette">
            <strong>Argent attendu</strong>
            <span>FCFA/ha, engrais déduit</span>
          </div>
          {resultats.map((r) => (
            <Cellule key={r.def.id} meilleur={r.def.id === meilleurId}>
              <span className="valeur">{fr(r.marge)} FCFA/ha</span>
              <span className="precision">
                {fr(r.margeBasse)} à {fr(r.margeHaute)}
              </span>
            </Cellule>
          ))}
        </div>

        <div className="ligne">
          <div className="etiquette">
            <strong>Eau manquante</strong>
            <span>mm sur la saison</span>
          </div>
          {resultats.map((r) => (
            <Cellule key={r.def.id} meilleur={r.def.id === meilleurId}>
              <span className="valeur">{r.deficit > 1 ? `${fr(r.deficit)} mm` : 'couvert'}</span>
              <span className="precision">rendement {fr(r.rendement * 100)} % du potentiel</span>
            </Cellule>
          ))}
        </div>

        <div className="ligne">
          <div className="etiquette">
            <strong>Terre perdue</strong>
            <span>t/ha/an, seuil 5</span>
          </div>
          {resultats.map((r) => (
            <Cellule key={r.def.id} meilleur={r.def.id === meilleurId}>
              <span className="valeur">{fr(r.erosion, 1)} t/ha/an</span>
              <span className="piste">
                <i
                  className={r.erosion > 5 ? 'piste-alerte' : 'piste-sol'}
                  style={{ width: `${Math.min(100, (r.erosion / 10) * 100)}%` }}
                />
              </span>
            </Cellule>
          ))}
        </div>

        <div className="ligne">
          <div className="etiquette">
            <strong>Matière organique</strong>
            <span>variation à 10 ans, points</span>
          </div>
          {resultats.map((r) => (
            <Cellule key={r.def.id} meilleur={r.def.id === meilleurId}>
              <span className="valeur">
                {r.mo10 > 0 ? '+' : ''}
                {fr(r.mo10, 2)} pt
              </span>
              <span className="precision">{r.mo10 > 0.05 ? 'tendance positive' : 'stable ou en recul'}</span>
            </Cellule>
          ))}
        </div>

        <div className="ligne">
          <div className="etiquette">
            <strong>Engrais à acheter</strong>
            <span>kg par hectare</span>
          </div>
          {resultats.map((r) => (
            <Cellule key={r.def.id} meilleur={r.def.id === meilleurId}>
              <span className="valeur">{fr(r.azote)} kg/ha</span>
              <span className="precision">
                {r.diversite} cultures · retour {r.def.cycle.length} ans
              </span>
            </Cellule>
          ))}
        </div>
      </div>

      <p className="comparateur-note">
        Les montants sont des ordres de grandeur convertis en FCFA par hectare : ils comparent des
        stratégies entre elles, ils ne promettent pas un revenu.
      </p>
    </div>
  );
}
