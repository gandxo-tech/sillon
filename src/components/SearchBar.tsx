import { useEffect, useMemo, useRef, useState } from 'react';
import { chercherLieux, type Lieu } from '../api/sources';

interface Props {
  onChoix: (lat: number, lon: number, nom: string) => void;
  chargement: boolean;
}

function parserCoordonnees(texte: string): { lat: number; lon: number } | null {
  const m = texte
    .replace(',', ' ')
    .match(/(-?\d{1,3}(?:\.\d+)?)\s+(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export default function SearchBar({ onChoix, chargement }: Props) {
  const [texte, setTexte] = useState('');
  const [suggestions, setSuggestions] = useState<Lieu[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState(false);
  const zone = useRef<HTMLDivElement>(null);

  const coords = useMemo(() => parserCoordonnees(texte), [texte]);

  useEffect(() => {
    const q = texte.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    let annule = false;
    const t = setTimeout(async () => {
      setRecherche(true);
      try {
        const lieux = await chercherLieux(q);
        if (!annule) {
          setSuggestions(lieux);
          setOuvert(lieux.length > 0);
          setErreur(lieux.length ? null : 'Aucun lieu trouvé. Essayez « ville, pays ».');
        }
      } catch {
        if (!annule) setErreur('Recherche de lieu indisponible. Entrez des coordonnées.');
      } finally {
        if (!annule) setRecherche(false);
      }
    }, 380);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [texte]);

  useEffect(() => {
    const clic = (e: MouseEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', clic);
    return () => document.removeEventListener('mousedown', clic);
  }, []);

  const lancer = (lat: number, lon: number, nom: string) => {
    setErreur(null);
    setOuvert(false);
    onChoix(lat, lon, nom);
  };

  const soumettre = () => {
    if (actif >= 0 && suggestions[actif]) {
      const l = suggestions[actif];
      setTexte(l.nom);
      lancer(l.lat, l.lon, `${l.nom}, ${l.pays}`);
      return;
    }
    if (coords) {
      lancer(coords.lat, coords.lon, `${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)}`);
      return;
    }
    if (suggestions[0]) {
      const l = suggestions[0];
      setTexte(l.nom);
      lancer(l.lat, l.lon, `${l.nom}, ${l.pays}`);
      return;
    }
    setErreur('Entrez un lieu, ou deux coordonnées (latitude longitude).');
  };

  const geolocaliser = () => {
    if (!navigator.geolocation) {
      setErreur('La géolocalisation n’est pas disponible dans ce navigateur.');
      return;
    }
    setRecherche(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRecherche(false);
        setTexte(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        lancer(pos.coords.latitude, pos.coords.longitude, 'Ma position');
      },
      () => {
        setRecherche(false);
        setErreur('Position refusée ou indisponible. Entrez un lieu ou des coordonnées.');
      },
      { timeout: 12000 },
    );
  };

  return (
    <div className="recherche" ref={zone}>
      <div className="recherche-champ">
        <svg className="recherche-icone" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12.6 12.6 17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={texte}
          placeholder="Une commune, une exploitation, ou 42.03 -93.46"
          aria-label="Lieu à analyser"
          onChange={(e) => {
            setTexte(e.target.value);
            setActif(-1);
          }}
          onFocus={() => suggestions.length && setOuvert(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActif((i) => Math.min(i + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActif((i) => Math.max(i - 1, -1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              soumettre();
            } else if (e.key === 'Escape') {
              setOuvert(false);
            }
          }}
        />
        <button type="button" className="bouton" onClick={soumettre} disabled={chargement || recherche}>
          {chargement ? 'Analyse…' : 'Analyser'}
        </button>
      </div>

      <div className="recherche-actions">
        <button type="button" className="lien" onClick={geolocaliser}>
          Utiliser ma position
        </button>
        <span className="recherche-sep">·</span>
        <span className="recherche-info">
          {coords
            ? `Coordonnées reconnues : ${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)}`
            : 'ou cliquez sur la carte après une première analyse'}
        </span>
      </div>

      {erreur && <p className="recherche-erreur">{erreur}</p>}

      {ouvert && suggestions.length > 0 && (
        <ul className="suggestions">
          {suggestions.map((l, i) => (
            <li key={`${l.lat}-${l.lon}-${l.nom}`}>
              <button
                type="button"
                className={i === actif ? 'est-actif' : ''}
                onMouseEnter={() => setActif(i)}
                onClick={() => {
                  setTexte(l.nom);
                  lancer(l.lat, l.lon, `${l.nom}, ${l.pays}`);
                }}
              >
                <strong>{l.nom}</strong>
                <span>{[l.detail, l.pays].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
