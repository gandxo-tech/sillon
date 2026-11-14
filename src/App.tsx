import { useMemo, useRef, useState } from 'react';
import SearchBar from './components/SearchBar';
import PointMap from './components/PointMap';
import FeatureCards from './components/FeatureCards';
import ClimateChart from './components/ClimateChart';
import RotationTable from './components/RotationTable';
import {
  chargerClassificationSol,
  chargerEra5,
  chargerHumiditeSol,
  chargerPower,
  chargerPrevisions,
  chargerProjection,
  chargerRelief,
  chargerSol,
  nommerLieu,
  type Previsions,
  type Projection,
} from './api/sources';
import { PrevisionsBloc, ProjectionBloc } from './components/Horizons';
import SelecteurCulture from './components/SelecteurCulture';
import Verdict from './components/Verdict';
import BoutonEcoute from './components/BoutonEcoute';
import { construireProfil, type Profil, type SourceStatut } from './analyse/features';
import {
  CONDITIONS,
  construireContexte,
  construireScenarios,
  resoudreCulture,
  type Condition,
} from './analyse/rotations';
import { construireRapport } from './analyse/report';

type Etat =
  | { statut: 'vide' }
  | { statut: 'chargement'; nom: string }
  | { statut: 'pret'; profil: Profil }
  | { statut: 'erreur'; message: string };

const fr = (v: number, d = 0) =>
  Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

export default function App() {
  const [etat, setEtat] = useState<Etat>({ statut: 'vide' });
  const [condition, setCondition] = useState<Condition>(CONDITIONS[0]);
  const [previsions, setPrevisions] = useState<Previsions | null>(null);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [cultureActuelle, setCultureActuelle] = useState('');
  const [cultureSuivante, setCultureSuivante] = useState('');
  const [irrigation, setIrrigation] = useState(0);
  const [pluiePctCustom, setPluiePctCustom] = useState(0);
  const [cycleLibre, setCycleLibre] = useState('');
  const [tempDeltaCustom, setTempDeltaCustom] = useState(0);
  const requete = useRef(0);

  const analyser = async (lat: number, lon: number, nom: string) => {
    const id = requete.current + 1;
    requete.current = id;
    setEtat({ statut: 'chargement', nom });

    const [powerR, era5R, humR, solR, reliefR, classifR, prevR, projR] = await Promise.allSettled([
      chargerPower(lat, lon),
      chargerEra5(lat, lon),
      chargerHumiditeSol(lat, lon),
      chargerSol(lat, lon),
      chargerRelief(lat, lon),
      chargerClassificationSol(lat, lon),
      chargerPrevisions(lat, lon),
      chargerProjection(lat, lon),
    ]);

    if (requete.current !== id) return;

    if (powerR.status !== 'fulfilled') {
      setEtat({
        statut: 'erreur',
        message:
          'NASA POWER n’a pas répondu pour ce point. Vérifiez votre connexion et réessayez — c’est la source qui porte l’essentiel du diagnostic.',
      });
      return;
    }

    const power = powerR.value;
    const era5 = era5R.status === 'fulfilled' ? era5R.value : null;
    const humidite = humR.status === 'fulfilled' ? humR.value : null;
    const solCharge = solR.status === 'fulfilled' ? solR.value : null;
    const sol = solCharge?.brut ?? null;
    const relief = reliefR.status === 'fulfilled' ? reliefR.value : null;
    const classification = classifR.status === 'fulfilled' ? classifR.value : null;

    let nomFinal = nom;
    if (/^-?\d/.test(nom) || nom === 'Ma position') {
      nomFinal = (await nommerLieu(lat, lon)) ?? nom;
      if (requete.current !== id) return;
    }

    const profil = construireProfil({
      lieu: { nom: nomFinal, lat, lon, pays: '' },
      power,
      era5,
      humidite,
      sol,
      relief,
      classification,
      statuts: {
        power: `${power.jours.length} jours exploitables, ${power.debut}–${power.fin}`,
        era5: era5 ? `${era5.jours.length} jours, ${era5.debut}–${era5.fin}` : null,
        humidite: humidite ? `année ${humidite.annee}` : null,
        sol: solCharge ? `${solCharge.fournisseur} — ${solCharge.note}` : null,
        relief: relief ? relief.source : null,
      },
    });

    setPrevisions(prevR.status === 'fulfilled' ? prevR.value : null);
    setProjection(projR.status === 'fulfilled' ? projR.value : null);
    setCondition(CONDITIONS[0]);
    setEtat({ statut: 'pret', profil });
  };

  const conditions = useMemo<Condition[]>(() => {
    const base = projection
      ? [
          ...CONDITIONS,
          {
            id: 'projection' as const,
            nom: `Projection 2045–2049 (${projection.modele.replace(/_/g, '-')})`,
            pluiePct: Math.round(projection.deltaP),
            tempDelta: Number(projection.deltaT.toFixed(1)),
          },
        ]
      : [...CONDITIONS];
    return [
      ...base,
      {
        id: 'custom' as const,
        nom: `Personnalisé (${pluiePctCustom >= 0 ? '+' : ''}${pluiePctCustom} % pluie, ${tempDeltaCustom >= 0 ? '+' : ''}${tempDeltaCustom} °C)`,
        pluiePct: pluiePctCustom,
        tempDelta: tempDeltaCustom,
      },
    ];
  }, [projection, pluiePctCustom, tempDeltaCustom]);

  const sourcesHorizon = useMemo<SourceStatut[]>(() => {
    const liste: SourceStatut[] = [];
    if (previsions) {
      liste.push({
        cle: 'previsions',
        nom: 'Open-Meteo — prévision',
        variable: 'Pluie, gel, ET0 à 14 jours',
        resolution: 'maillage 1–11 km · horaire',
        etat: 'ok',
        detail: 'modèle météorologique, fenêtre de 14 jours',
      });
    }
    if (projection) {
      liste.push({
        cle: 'projection',
        nom: 'CMIP6 — Open-Meteo Climate',
        variable: 'Température et pluie projetées',
        resolution: '≈ 25 km · quotidien',
        etat: 'ok',
        detail: `${projection.modele.replace(/_/g, '-')}, 2045–2049 contre 1995–1999`,
      });
    }
    return liste;
  }, [previsions, projection]);

  const contexte = useMemo(
    () => (etat.statut === 'pret' ? construireContexte(etat.profil, irrigation) : null),
    [etat, irrigation],
  );
  const rotations = useMemo(
    () =>
      contexte
        ? construireScenarios(contexte, condition, {
            actuelle: cultureActuelle,
            suivante: cultureSuivante,
            cycle: cycleLibre,
          })
        : [],
    [contexte, condition, cultureActuelle, cultureSuivante],
  );
  const rapport = useMemo(
    () => (etat.statut === 'pret' ? construireRapport(etat.profil, rotations, condition) : null),
    [etat, rotations, condition],
  );

  const meilleurId = useMemo(() => {
    if (!rotations.length) return '';
    const viables = [...rotations].filter((r) => r.viable).sort((a, b) => b.scoreGlobal - a.scoreGlobal);
    return (viables[0] ?? [...rotations].sort((a, b) => b.scoreGlobal - a.scoreGlobal)[0]).def.id;
  }, [rotations]);

  const section = (titre: string) => rapport?.sections.find((s) => s.titre === titre);
  const meilleur = rotations.find((r) => r.def.id === meilleurId) ?? null;

  const horsBase = useMemo(() => {
    const trouve = [resoudreCulture(cultureActuelle), resoudreCulture(cultureSuivante)].find((x) => x.approx);
    return trouve ? trouve.culture.court : null;
  }, [cultureActuelle, cultureSuivante]);

  const noteEstimation = horsBase ? (
    <p className="culture-note">
      « {horsBase} » n’est pas dans la base : faute de coefficients mesurés, Sillon applique une
      culture générique de 120 jours à besoin en eau moyen. Le score reste comparable, mais c’est une
      estimation à confirmer par vos références locales.
    </p>
  ) : null;

  return (
    <>
      <header className="top">
        <div className="wrap top-inner">
          <div className="marque-bloc">
            <svg className="marque" viewBox="0 0 40 40" aria-hidden="true">
              <path d="M4 13h32M4 20h32M4 27h32" stroke="#e8c36a" strokeWidth="3" strokeLinecap="round" />
              <path
                d="M8 13c4 0 4 7 8 7s4-7 8-7 4 7 8 7"
                stroke="#f6f7f2"
                strokeWidth="1.4"
                fill="none"
                opacity="0.5"
              />
            </svg>
            <div>
              <p className="marque-nom">Sillon</p>
              <p className="marque-role">Aide à la décision · rotations de cultures</p>
            </div>
          </div>
          <p className="top-note">
            Observation de la Terre en direct · NASA POWER (pluie, température, humidité GWETTOP) · ERA5 · SoilGrids · SRTM · GIBS
          </p>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <h1>
            Un point sur la carte.
            <br />
            Un rapport qui tient debout.
          </h1>
          <p className="hero-sous">
            Donnez un lieu : Sillon va chercher la pluie réelle des dix dernières années, la demande
            évaporative, la texture du sol, la pente, puis compare quatre rotations et vous explique
            pourquoi l’une ressort.
          </p>

          <SearchBar onChoix={analyser} chargement={etat.statut === 'chargement'} />

          <SelecteurCulture
            actuelle={cultureActuelle}
            suivante={cultureSuivante}
            onChange={(champ, valeur) =>
              champ === 'actuelle' ? setCultureActuelle(valeur) : setCultureSuivante(valeur)
            }
          />

          {noteEstimation}

          <p className="hero-note">
            Un lieu, deux cultures, aucun compte. Huit sources publiques sont interrogées à chaque
            analyse ; celles qui échouent sont affichées en bas du rapport. Le résultat se lit à
            l’image, et peut s’écouter.
          </p>
        </section>

        {etat.statut === 'chargement' && (
          <div className="chargement" role="status" aria-live="polite">
            <span className="chargement-rond" aria-hidden="true" />
            <div>
              <strong>Analyse de {etat.nom}</strong>
              <p>
                NASA POWER (10 ans de pluie et de températures), ERA5 (ET0 et gel), SoilGrids
                (texture, carbone, pH), SRTM (pente) et l’imagerie MODIS. Comptez quelques secondes.
              </p>
            </div>
          </div>
        )}

        {etat.statut === 'erreur' && (
          <div className="erreur" role="alert">
            <strong>Analyse interrompue</strong>
            <p>{etat.message}</p>
            <button type="button" className="lien" onClick={() => setEtat({ statut: 'vide' })}>
              Revenir à la recherche
            </button>
          </div>
        )}

        {etat.statut === 'pret' && rapport && (
          <div className="rapport">
            <section className="rapport-tete">
              <div>
                <p className="sur-titre">Rapport de parcelle</p>
                <h2>{etat.profil.lieu.nom}</h2>
                <p className="rapport-meta">
                  {etat.profil.lieu.lat.toFixed(4)}°, {etat.profil.lieu.lon.toFixed(4)}° ·{' '}
                  {etat.profil.periode} · généré le{' '}
                  {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <button type="button" className="bouton-imprimer" onClick={() => window.print()}>
                  Imprimer le rapport
                </button>
                <BoutonEcoute texte={rapport.parle} />
              </div>
              <PointMap
                lat={etat.profil.lieu.lat}
                lon={etat.profil.lieu.lon}
                nom={etat.profil.lieu.nom}
                onClic={(la, lo) => analyser(la, lo, `${la.toFixed(3)}, ${lo.toFixed(3)}`)}
              />
            </section>

            <section className="section">
              <div className="section-tete">
                <span className="section-num">01</span>
                <h3>Synthèse</h3>
              </div>
              <div className="synthese">
                <ul className="cles">
                  {rapport.cles.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                {rapport.synthese.map((par) => (
                  <p key={par.slice(0, 40)}>{par}</p>
                ))}
              </div>
            </section>

            <section className="section">
              <div className="section-tete">
                <span className="section-num">02</span>
                <h3>Ce que la localisation révèle</h3>
              </div>
              <FeatureCards profil={etat.profil} />

              {section('Ce que la localisation révèle') && (
                <div className="developpe">
                  {section('Ce que la localisation révèle')!.paragraphes.map((par) => (
                    <p key={par.slice(0, 40)}>{par}</p>
                  ))}
                  <ul>
                    {section('Ce que la localisation révèle')!.puces?.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="section">
              <div className="section-tete">
                <span className="section-num">03</span>
                <h3>Le rythme de l’eau</h3>
              </div>
              <ClimateChart
                mois={etat.profil.graphique.mois}
                pluie={etat.profil.graphique.pluie}
                et0={etat.profil.graphique.et0}
                humidite={etat.profil.graphique.humidite}
                anneeHumidite={etat.profil.graphique.anneeHumidite}
              />
              <div className="horizons">
                {previsions && <PrevisionsBloc data={previsions} />}
                {projection && <ProjectionBloc data={projection} />}
              </div>
              {section('Ce que cela change pour la rotation') && (
                <div className="developpe">
                  {section('Ce que cela change pour la rotation')!.paragraphes.map((par) => (
                    <p key={par.slice(0, 40)}>{par}</p>
                  ))}
                </div>
              )}
            </section>

            <section className="section">
              <div className="section-tete">
                <span className="section-num">04</span>
                <h3>Quatre rotations, un même lieu</h3>
              </div>
              <SelecteurCulture
                compact
                actuelle={cultureActuelle}
                suivante={cultureSuivante}
                onChange={(champ, valeur) =>
                  champ === 'actuelle' ? setCultureActuelle(valeur) : setCultureSuivante(valeur)
                }
              />

              {noteEstimation}

              <label className="cycle-libre">
                <span>Cycle complet (optionnel, cultures séparées par des virgules)</span>
                <input
                  type="text"
                  value={cycleLibre}
                  onChange={(e) => setCycleLibre(e.target.value)}
                  placeholder="maïs, soja, blé, couvert"
                  autoComplete="off"
                />
              </label>

              <div className="contraintes">
                <h4>Contraintes locales</h4>
                <label>
                  Irrigation disponible (mm sur la saison)
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={irrigation}
                    onChange={(e) => setIrrigation(Number(e.target.value) || 0)}
                  />
                </label>
                <label>
                  Pluie de saison : {pluiePctCustom >= 0 ? '+' : ''}{pluiePctCustom} %
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    value={pluiePctCustom}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setPluiePctCustom(v);
                      setCondition({
                        id: 'custom',
                        nom: `Personnalisé (${v >= 0 ? '+' : ''}${v} % pluie, ${tempDeltaCustom >= 0 ? '+' : ''}${tempDeltaCustom} °C)`,
                        pluiePct: v,
                        tempDelta: tempDeltaCustom,
                      });
                    }}
                  />
                </label>
                <label>
                  Température : {tempDeltaCustom >= 0 ? '+' : ''}{tempDeltaCustom} °C
                  <input
                    type="range"
                    min={-2}
                    max={4}
                    step={0.5}
                    value={tempDeltaCustom}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setTempDeltaCustom(v);
                      setCondition({
                        id: 'custom',
                        nom: `Personnalisé (${pluiePctCustom >= 0 ? '+' : ''}${pluiePctCustom} % pluie, ${v >= 0 ? '+' : ''}${v} °C)`,
                        pluiePct: pluiePctCustom,
                        tempDelta: v,
                      });
                    }}
                  />
                </label>
              </div>

              <RotationTable
                resultats={rotations}
                condition={condition}
                conditions={conditions}
                onCondition={setCondition}
                meilleurId={meilleurId}
              />
              {section('Comment lire la comparaison') && (
                <div className="developpe">
                  {section('Comment lire la comparaison')!.paragraphes.map((par) => (
                    <p key={par.slice(0, 40)}>{par}</p>
                  ))}
                </div>
              )}
            </section>

            <section className="section">
              <div className="section-tete">
                <span className="section-num">05</span>
                <h3>La recommandation, et ses angles morts</h3>
              </div>

              {meilleur && (
                <Verdict retenu={meilleur} reference={rotations[0]} condition={condition.nom} />
              )}

              <div className="reco">
                <div className="reco-corps">
                  <p className="sur-titre reco-sur-titre">
                    Meilleur compromis dans la condition « {condition.nom} »
                  </p>
                  <h4>{rapport.recommandation.nom}</h4>
                  <p className="reco-accroche">{rapport.recommandation.accroche}</p>
                  <ul className="raisons">
                    {rapport.recommandation.raisons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div className="reco-score">
                  <p className="reco-nombre">
                    {fr(rapport.recommandation.score)}
                    <span>/ 100</span>
                  </p>
                  <p className="reco-legende">
                    Pondération : eau 28 %, sol 26 %, revenu 28 %, résilience 18 %.
                  </p>
                </div>
              </div>

              <div className="alertes">
                <h4>À vérifier avant de décider</h4>
                <ul>
                  {rapport.recommandation.alertes.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>

              <div className="alternatives">
                <h4 className="alternatives-titre">Les autres pistes</h4>
                <div className="alternatives-grille">
                  {rapport.recommandation.alternatives.map((a) => (
                    <article key={a.nom} className="alternative">
                      <div className="alternative-tete">
                        <strong>{a.nom}</strong>
                        <span>{fr(a.score)} / 100</span>
                      </div>
                      <p>{a.pourquoi}</p>
                    </article>
                  ))}
                </div>
              </div>

              {section('Ce que l’outil ne peut pas voir') && (
                <div className="developpe">
                  {section('Ce que l’outil ne peut pas voir')!.paragraphes.map((par) => (
                    <p key={par.slice(0, 40)}>{par}</p>
                  ))}
                </div>
              )}
            </section>

            <section className="section">
              <div className="section-tete">
                <span className="section-num">06</span>
                <h3>Sources, résolutions, échecs</h3>
              </div>
              <div className="sources-table">
                {[...etat.profil.sources, ...sourcesHorizon].map((s) => (
                  <div className={`source ${s.etat === 'ok' ? 'source-ok' : 'source-echec'}`} key={s.cle}>
                    <div className="source-tete">
                      <strong>{s.nom}</strong>
                      <span className={`etat etat-${s.etat}`}>{s.etat === 'ok' ? 'utilisée' : 'indisponible'}</span>
                    </div>
                    <p className="source-variable">{s.variable}</p>
                    <p className="source-resolution">{s.resolution}</p>
                    <p className="source-detail">{s.detail}</p>
                  </div>
                ))}
              </div>
              <p className="methode-note">
                Méthode : pluie et températures NASA POWER (2016–2025) ; ET0 ERA5 (2021–2025, Penman-Monteith
                FAO-56, repli Hargreaves) ; sol SoilGrids 0–60 cm ; pente calculée sur cinq points
                espacés d’un kilomètre ; érosion RUSLE avec R dérivé de la pluie annuelle, K issu de
                la texture, LS de la pente mesurée et C de la couverture du cycle ;                 azote et matière organique issus de coefficients agronomiques standards. ET0 = demande en eau de l’air ; K = sensibilité du sol à l’érosion ; RUSLE = estimation de l’érosion à partir de la pluie, du sol, de la pente et du couvert.
              </p>
            </section>
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <p className="footer-marque">
            <span className="footer-logo" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <strong>Soil AI Crew</strong> · NASA Space Apps Challenge 2026
          </p>
          <p>
            <strong>Sillon</strong> est un support d’aide à la décision. Il ne remplace ni
            l’observation de terrain, ni le savoir-faire de l’exploitant, ni l’expertise d’un
            agronome. Les recommandations sont des hypothèses à instruire, pas des prescriptions.
          </p>
          <p className="footer-sources">
            NASA POWER · GPM IMERG (via POWER) · ERA5 / Copernicus · SoilGrids (ISRIC) · USGS 3DEP /
            SRTM · Open-Meteo · Google Maps · NASA GIBS (MODIS Terra) · OpenStreetMap
          </p>
          <p className="footer-signature">
            Fait par l’équipe « Soil AI Crew » — développé par DAOUDA Abdou Chahid, Exaucé GBAGUIDI,
            Pancrace KANHONOU. Contributions : github.com/daouda-4
          </p>
        </div>
      </footer>
    </>
  );
}