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
import BoutonEcoute from './components/BoutonEcoute';
import { construireProfil, type Profil, type SourceStatut } from './analyse/features';
import {
  CONDITIONS,
  construireContexte,
  resoudreCulture,
  type Condition,
  type Culture,
} from './analyse/rotations';
import {
  CAPITAL_FCFA,
  PRIORITES_DEFAUT,
  chercherRotations,
  type NiveauCapital,
  type Priorites,
} from './moteur/moteur';
import { construireRapport, type Bloc, type Rapport } from './rapport/rapport';

type Etat =
  | { statut: 'vide' }
  | { statut: 'chargement'; nom: string }
  | { statut: 'pret'; profil: Profil }
  | { statut: 'erreur'; message: string };

const fr = (v: number, d = 0) =>
  Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

const CURSEURS: { cle: keyof Priorites; label: string; aide: string }[] = [
  { cle: 'revenu', label: 'Gagner de l’argent', aide: 'Le prix de vente compte pour vous' },
  { cle: 'securiteAlimentaire', label: 'Nourrir la maison', aide: 'Le grenier avant le marché' },
  { cle: 'sobrieteEau', label: 'Économiser l’eau', aide: 'La sécheresse vous inquiète' },
  { cle: 'autonomieIntrants', label: 'Acheter moins d’engrais', aide: 'Réduire les achats d’intrants' },
  { cle: 'preservationSol', label: 'Protéger la terre', aide: 'Garder le sol en place' },
  { cle: 'disponibiliteMainOeuvre', label: 'Main-d’œuvre disponible', aide: '0 = personne, 100 = bras toute la saison' },
];

function BlocVue({ bloc, verdict }: { bloc: Bloc; verdict: Rapport['verdict'] }) {
  if (bloc.type === 'verdict') {
    return (
      <section className={`section conclusion-simple ${verdict.niveau === 'non' ? 'conclusion-non' : 'conclusion-oui'}`}>
        <span className="conclusion-badge">{verdict.badgeCourt}</span>
        <div>
          <p>{verdict.phrase}</p>
          <p className="reco-accroche">{verdict.rotation}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="section-tete">
        {bloc.numero > 0 && <span className="section-num">{String(bloc.numero).padStart(2, '0')}</span>}
        <h3>{bloc.titre}</h3>
      </div>

      {bloc.paragraphes.map((p) => (
        <p key={p}>{p}</p>
      ))}

      {bloc.type === 'tableau' && bloc.tableau && (
        <div className="table-rotations">
          <div className="ligne ligne-tete">
            <div className="etiquette">
              <strong>Ce qui change</strong>
              <span>chez vous</span>
            </div>
            {bloc.tableau.entetes.map((e, i) => (
              <div className={`cellule${i === 1 ? ' cellule-meilleure' : ''}`} key={`${e.nom}-${i}`}>
                <span className="role">{i === 0 ? 'Aujourd’hui' : `Option ${i}`}</span>
                <h4>{e.nom}</h4>
                <p className="cycle">{e.suite}</p>
                <span className="score">{fr(e.score, 1)}</span>
              </div>
            ))}
          </div>
          {bloc.tableau.lignes.map((l) => (
            <div className="ligne" key={l.libelle}>
              <div className="etiquette">
                <strong>{l.libelle}</strong>
                <span>{l.lecture}</span>
              </div>
              {l.valeurs.map((v, i) => (
                <div className={`cellule${i === 1 ? ' cellule-meilleure' : ''}`} key={`${l.libelle}-${i}`}>
                  <span className="valeur">{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {bloc.type === 'options' && bloc.options && (
        <div className="alternatives">
          <div className="alternatives-grille">
            {bloc.options.map((o) => (
              <article className={`alternative${o.meilleure ? ' cellule-meilleure' : ''}`} key={o.nom}>
                <div className="alternative-tete">
                  <strong>{o.nom}</strong>
                  <span>{fr(o.score, 1)} / 100</span>
                </div>
                <p className="cycle">{o.suite}</p>
                <p>{o.gagne}</p>
                <p>{o.coute}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      {bloc.puces?.length || bloc.rejets?.length ? (
        <div className="developpe">
          {bloc.rejets?.length ? (
            <ul>
              {bloc.rejets.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          {bloc.puces?.length ? (
            <ul>
              {bloc.puces.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {bloc.type === 'technique' && (
        <details className="developpe">
          <summary>Ouvrir la partie technique</summary>
          {bloc.paragraphes.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {bloc.sources && (
            <div className="sources-table">
              {bloc.sources.map((s) => (
                <div className={`source ${s.etat === 'ok' ? 'source-ok' : 'source-echec'}`} key={s.nom}>
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
          )}
        </details>
      )}
    </section>
  );
}

export default function App() {
  const [etat, setEtat] = useState<Etat>({ statut: 'vide' });
  const [condition, setCondition] = useState<Condition>(CONDITIONS[0]);
  const [previsions, setPrevisions] = useState<Previsions | null>(null);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [cultureActuelle, setCultureActuelle] = useState('');
  const [cultureSuivante, setCultureSuivante] = useState('');
  const [cycleLibre, setCycleLibre] = useState('');
  const [irrigation, setIrrigation] = useState(0);
  const [pluiePctCustom, setPluiePctCustom] = useState(0);
  const [tempDeltaCustom, setTempDeltaCustom] = useState(0);
  const [priorites, setPriorites] = useState<Priorites>(PRIORITES_DEFAUT);
  const [cheptel, setCheptel] = useState(false);
  const [capital, setCapital] = useState<NiveauCapital>('faible');
  const [historique, setHistorique] = useState('');
  const [conseil, setConseil] = useState<string | null>(null);
  const [conseilCharge, setConseilCharge] = useState(false);
  const [conseilErreur, setConseilErreur] = useState<string | null>(null);
  const [conseilModele, setConseilModele] = useState<string | null>(null);
  const requete = useRef(0);
  const fichierRef = useRef<HTMLInputElement>(null);

  const importerFichier = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = () => {
      const texte = String(lecteur.result ?? '');
      try {
        const lignes = texte.trim().split(/\r?\n/).filter(Boolean);
        if (!lignes.length) throw new Error('fichier vide');
        const sep = lignes[0].includes(';') ? ';' : ',';
        const entete = lignes[0].split(sep).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
        const get = (cles: string[]) => {
          for (const c of cles) {
            const i = entete.findIndex((h) => cles.includes(h) || h.includes(c));
            if (i >= 0 && lignes[1]) {
              const cols = lignes[1].split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
              if (cols[i]) return cols[i];
            }
          }
          return '';
        };
        const lat = Number(get(['lat', 'latitude']));
        const lon = Number(get(['lon', 'longitude', 'long']));
        const nom = get(['lieu', 'place', 'nom', 'location', 'commune']);
        const act = get(['actuelle', 'current', 'culture_actuelle', 'culture en place', 'culture1']);
        const suiv = get(['suivante', 'next', 'culture_suivante', 'culture2']);
        const irr = get(['irrigation', 'irrigation_mm', 'eau']);
        const cycle = get(['cycle', 'rotation', 'cycle_complet', 'succession']);
        const hist = get(['historique', 'history', 'cultures_precedentes']);
        if (act) setCultureActuelle(act);
        if (suiv) setCultureSuivante(suiv);
        if (irr) setIrrigation(Number(irr) || 0);
        if (cycle) setCycleLibre(cycle);
        if (hist) setHistorique(hist);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          analyser(lat, lon, nom || `${lat.toFixed(3)}, ${lon.toFixed(3)}`);
        }
      } catch {
        window.alert('Import impossible : fichier CSV attendu (lieu, lat, lon, actuelle, suivante…).');
      }
    };
    lecteur.readAsText(fichier);
    e.target.value = '';
  };

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
        variable: 'Pluie, gel, demande de l’air à 14 jours',
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

  /** La rotation actuelle part des cultures réellement saisies. */
  const saisie = useMemo<{ cultures: Culture[]; approx: boolean; nom: string }>(() => {
    const morceaux = cycleLibre.trim()
      ? cycleLibre.split(/[,;›]+/).map((x) => x.trim()).filter(Boolean)
      : [cultureActuelle, cultureSuivante].filter((x) => x.trim().length > 0);
    const textes = morceaux.length ? morceaux : ['maïs'];
    const resolus = textes.map((t) => resoudreCulture(t));
    return {
      cultures: resolus.map((r) => r.culture),
      approx: resolus.some((r) => r.approx),
      nom: resolus.map((r) => r.culture.court).join(' puis '),
    };
  }, [cultureActuelle, cultureSuivante, cycleLibre]);

  const contexte = useMemo(
    () => (etat.statut === 'pret' ? construireContexte(etat.profil, irrigation) : null),
    [etat, irrigation],
  );

  const sortie = useMemo(
    () =>
      etat.statut === 'pret' && contexte
        ? chercherRotations({
            ctx: contexte,
            condition,
            priorites,
            cheptel,
            capital,
            historique: historique.split(/[,;›]+/).map((x) => x.trim()).filter(Boolean).slice(-3),
            actuelle: saisie.cultures,
            approx: saisie.approx,
            lat: etat.profil.lieu.lat,
            lon: etat.profil.lieu.lon,
          })
        : null,
    [etat, contexte, condition, priorites, cheptel, capital, historique, saisie],
  );

  const rapport = useMemo(
    () => (etat.statut === 'pret' && sortie ? construireRapport(etat.profil, sortie, saisie.nom) : null),
    [etat, sortie, saisie],
  );

  const resultats = useMemo(
    () => (sortie ? [sortie.reference.resultat, ...sortie.classement.slice(0, 3).map((c) => c.resultat)] : []),
    [sortie],
  );
  const meilleurId = sortie?.meilleure.id ?? '';

  const noteEstimation = saisie.approx ? (
    <p className="culture-note">
      Une culture saisie n’est pas dans la base : faute de coefficients mesurés, Sillon applique une
      culture générique de 120 jours. Le score reste comparable, mais c’est une estimation à
      confirmer par vos références locales.
    </p>
  ) : null;

  const demanderConseil = async () => {
    if (etat.statut !== 'pret' || !rapport) return;
    setConseilCharge(true);
    setConseilErreur(null);
    setConseil(null);
    setConseilModele(null);
    const contexteTexte = [
      `Lieu : ${etat.profil.lieu.nom} (${etat.profil.lieu.lat.toFixed(3)}, ${etat.profil.lieu.lon.toFixed(3)}).`,
      rapport.cles.join(' '),
      `Culture en place : ${cultureActuelle || 'non précisée'}.`,
      `Culture suivante : ${cultureSuivante || 'non précisée'}.`,
      `Irrigation disponible : ${irrigation} mm.`,
    ]
      .filter(Boolean)
      .join(' ');
    try {
      const r = await fetch('/api/ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contexte: contexteTexte }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erreur || 'Erreur');
      setConseil(j.reponse);
      setConseilModele(typeof j.modele === 'string' ? j.modele : null);
    } catch (e) {
      setConseilErreur(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setConseilCharge(false);
    }
  };

  return (
    <>
      <header className="top">
        <div className="wrap top-inner">
          <div className="marque-bloc">
            <img
              className="marque"
              src="/logo-soil-ai-crew.png"
              alt="Logo Soil AI Crew — NASA Space Apps 2026"
              width={512}
              height={512}
            />
            <div>
              <p className="marque-nom">Sillon</p>
              <p className="marque-role">Aide à la décision · rotations de cultures</p>
            </div>
          </div>
          <p className="top-note">
            Observation de la Terre en direct · NASA POWER (pluie, température, humidité) · ERA5 · SoilGrids · SRTM · GIBS
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
            Donnez un lieu : Sillon va chercher la pluie réelle des dix dernières années, la soif de
            l’air, la terre et la pente. Puis il cherche la rotation qui vous convient et vous explique
            pourquoi.
          </p>

          <SearchBar onChoix={analyser} chargement={etat.statut === 'chargement'} />

          <SelecteurCulture
            actuelle={cultureActuelle}
            suivante={cultureSuivante}
            onChange={(champ, valeur) =>
              champ === 'actuelle' ? setCultureActuelle(valeur) : setCultureSuivante(valeur)
            }
          />

          <label className="cycle-libre">
            <span>Toutes vos cultures, autant que vous voulez (séparées par des virgules)</span>
            <input
              type="text"
              name="cultures"
              value={cycleLibre}
              onChange={(e) => setCycleLibre(e.target.value)}
              placeholder="maïs, niébé, fonio, sésame, patate douce…"
              autoComplete="off"
            />
          </label>
          <p className="culture-aide">
            Écrivez ce que vous voulez, même une culture absente de la base : Sillon l’accepte,
            l’utilise dans sa recherche et signale l’estimation. Si ce champ est rempli, il remplace
            les deux cultures ci-dessus.
          </p>

          {noteEstimation}

          <div className="import-csv">
            <button type="button" className="lien" onClick={() => fichierRef.current?.click()}>
              Importer un fichier CSV
            </button>
            <span> (CSV ; lieu, latitude, longitude, culture en place, culture suivante, historique…)</span>
            <input ref={fichierRef} type="file" accept=".csv,.txt" onChange={importerFichier} hidden />
          </div>

          <p className="hero-note">
            Un lieu, vos cultures, aucun compte. Les sources publiques sont interrogées à chaque
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
                NASA POWER (10 ans de pluie et de températures), ERA5 (demande de l’air et gel),
                SoilGrids (texture, carbone, pH), SRTM (pente) et l’imagerie MODIS. Comptez quelques
                secondes.
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

        {etat.statut === 'pret' && rapport && sortie && (
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
                <h3>Vos priorités</h3>
              </div>
              <div className="contraintes">
                {CURSEURS.map((c) => (
                  <label key={c.cle}>
                    {c.label} : {priorites[c.cle]}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={priorites[c.cle]}
                      onChange={(e) =>
                        setPriorites((p) => ({ ...p, [c.cle]: Number(e.target.value) }))
                      }
                    />
                    <span className="precision">{c.aide}</span>
                  </label>
                ))}
                <label>
                  <span>
                    <input
                      type="checkbox"
                      checked={cheptel}
                      onChange={(e) => setCheptel(e.target.checked)}
                    />{' '}
                    J’ai des animaux (cheptel)
                  </span>
                </label>
                <label>
                  Budget d’intrants par hectare
                  <select value={capital} onChange={(e) => setCapital(e.target.value as NiveauCapital)}>
                    {(Object.keys(CAPITAL_FCFA) as NiveauCapital[]).map((niveau) => (
                      <option key={niveau} value={niveau}>
                        {niveau} — {fr(CAPITAL_FCFA[niveau])} FCFA
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Les trois dernières cultures (de la plus ancienne à la plus récente)
                                      <input
                      type="text"
                      name="historique"
                      value={historique}
                      onChange={(e) => setHistorique(e.target.value)}
                      placeholder="sorgho, niébé, maïs"
                      autoComplete="off"
                    />
                </label>
                <label>
                  Irrigation disponible (mm sur la saison)
                  <input
                    type="number"
                    name="irrigation"
                    min={0}
                    max={500}
                    value={irrigation}
                    onChange={(e) => setIrrigation(Number(e.target.value) || 0)}
                  />
                </label>
              </div>
              <p className="precision">
                {sortie.nombreCandidats} successions construites à partir de vos cultures et
                examinées une par une, {sortie.rejets.length} écartées avant classement.
              </p>
            </section>

            {rapport.blocs.map((bloc) => (
              <BlocVue bloc={bloc} verdict={rapport.verdict} key={`${bloc.numero}-${bloc.titre}`} />
            ))}

            <section className="section">
              <div className="section-tete">
                <h3>Comparateur détaillé</h3>
              </div>
              <RotationTable
                resultats={resultats}
                condition={condition}
                conditions={conditions}
                onCondition={setCondition}
                meilleurId={meilleurId}
              />

              <div className="conseil-ia">
                <button
                  type="button"
                  className="lien conseil-bouton"
                  onClick={demanderConseil}
                  disabled={conseilCharge}
                >
                  {conseilCharge ? 'Réflexion en cours…' : 'Demander un conseil à l’IA'}
                </button>
                {conseilErreur && <p className="conseil-erreur">{conseilErreur}</p>}
                {conseil && <p className="conseil-reponse">{conseil}</p>}
                {conseil && conseilModele && (
                  <p className="conseil-note">
                    Conseil généré par {conseilModele} · à confronter à votre terrain.
                  </p>
                )}
              </div>

              <details className="developpe">
                <summary>Ce que la parcelle montre</summary>
                <FeatureCards profil={etat.profil} />
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
                {sourcesHorizon.map((s) => (
                  <p className="precision" key={s.cle}>
                    {s.nom} · {s.variable} · {s.detail}
                  </p>
                ))}
              </details>
            </section>
          </div>
        )}

        <section className="section faq" aria-labelledby="faq-titre">
          <div className="section-tete">
            <h2 id="faq-titre">Questions fréquentes</h2>
          </div>
          <details>
            <summary>Sillon remplace-t-il un agronome ?</summary>
            <p>
              Non. Sillon donne un point de départ chiffré et la trace de son raisonnement. La
              décision finale reste à l’exploitant et à son agronome, qui connaissent le terrain.
            </p>
          </details>
          <details>
            <summary>D’où viennent les prix en FCFA ?</summary>
            <p>
              D’une table fixe dans le code (marges brutes par culture). Ce n’est pas le marché de
              la semaine ; calibrer cette table avec les acheteurs de la coopérative est la première
              étape d’un déploiement.
          </p>
          </details>
          <details>
            <summary>Que se passe-t-il si une source de données tombe ?</summary>
            <p>
              L’application se dégrade et signale l’échec. Chaque source rend son propre état dans
              le rapport (bloc 8). Le moteur tourne sur les données disponibles et indique « données
              partielles » quand une source a échoué.
          </p>
          </details>
          <details>
            <summary>Le sol est vu tous les 250 m : est-ce assez précis ?</summary>
            <p>
              Non au niveau du champ. SoilGrids est une prédiction globale. Le rapport le dit
              clairement et recommande une analyse de terre pour trancher.
          </p>
          </details>
          <details>
            <summary>Le système propose-t-il des cultures qui ne poussent pas ici ?</summary>
            <p>
              Non pour les suggestions automatiques : la recherche élargie n’ajoute que des cultures
              compatibles avec la zone climatique de votre parcelle (déduite de la latitude). Le blé,
              par exemple, n’est proposé qu’en zone tempérée. Si vous saisissez vous-même une culture,
              elle est respectée, mais le rapport signale qu’elle est estimée.
            </p>
          </details>
          <details>
            <summary>La langue s’adapte-t-elle à l’utilisateur ?</summary>
            <p>
              Oui : les sept premiers blocs du rapport évitent le jargon, et les termes techniques
              sont réservés au bloc 8 replié. Le conseil IA répond en français simple. Une version
              vocale en mooré et en dioula est prévue (feuille de route).
          </p>
          </details>
          <details>
            <summary>Comment sont protégées mes données ?</summary>
            <p>
              Aucun compte, aucune donnée personnelle envoyée à un serveur Sillon. Les calculs
              tournent dans votre navigateur ; seules les requêtes vers les sources publiques
              (NASA, Open-Meteo, etc.) quittent votre machine.
          </p>
          </details>
        </section>
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
