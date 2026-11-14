import { useEffect, useRef, useState } from 'react';

interface Props {
  lat: number;
  lon: number;
  nom: string;
  onClic?: (lat: number, lon: number) => void;
}

/** Clé facultative : sans elle, on affiche la carte Google en mode intégré. */
const CLE = (import.meta as unknown as { env?: Record<string, string> }).env
  ?.VITE_GOOGLE_MAPS_API_KEY;

const BLEU = '#0018ff';
const JAUNE = '#fff200';

interface CarteGoogle {
  map: any;
  marqueur: any;
  cercle: any;
}

function chargerGoogle(): Promise<any> {
  const w = window as unknown as { google?: any; __googleMaps?: Promise<any> };
  if (w.google?.maps) return Promise.resolve(w.google.maps);
  if (!w.__googleMaps) {
    w.__googleMaps = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(CLE!)}&v=weekly&language=fr&region=FR`;
      s.async = true;
      s.onload = () => resolve((window as unknown as { google: any }).google.maps);
      s.onerror = () => reject(new Error('Google Maps n’a pas pu être chargé'));
      document.head.appendChild(s);
    });
  }
  return w.__googleMaps;
}

export default function PointMap({ lat, lon, nom, onClic }: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<CarteGoogle | null>(null);
  const clicRef = useRef(onClic);
  const [echec, setEchec] = useState(false);
  clicRef.current = onClic;

  useEffect(() => {
    if (!CLE || !conteneur.current || carte.current) return;
    let vivant = true;

    chargerGoogle()
      .then((maps) => {
        if (!vivant || !conteneur.current) return;
        const map = new maps.Map(conteneur.current, {
          center: { lat, lng: lon },
          zoom: 13,
          mapTypeId: 'hybrid',
          mapTypeControl: true,
          fullscreenControl: false,
          streetViewControl: false,
          gestureHandling: 'cooperative',
          clickableIcons: false,
        });

        const marqueur = new maps.Marker({
          position: { lat, lng: lon },
          map,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: BLEU,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        const cercle = new maps.Circle({
          center: { lat, lng: lon },
          radius: 600,
          strokeColor: JAUNE,
          strokeWeight: 2,
          fillColor: JAUNE,
          fillOpacity: 0.12,
          clickable: false,
          map,
        });

        map.addListener('click', (e: { latLng: { lat(): number; lng(): number } }) => {
          clicRef.current?.(e.latLng.lat(), e.latLng.lng());
        });

        carte.current = { map, marqueur, cercle };
      })
      .catch(() => setEchec(true));

    return () => {
      vivant = false;
      if (carte.current) {
        carte.current.marqueur.setMap(null);
        carte.current.cercle.setMap(null);
        carte.current.map = null;
        carte.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const c = carte.current;
    if (!c || !c.map) return;
    const position = { lat, lng: lon };
    c.marqueur.setPosition(position);
    c.cercle.setCenter(position);
    c.map.setCenter(position);
  }, [lat, lon]);

  if (!CLE || echec) {
    const src = `https://www.google.com/maps?q=${lat},${lon}&z=13&t=k&hl=fr&output=embed`;
    return (
      <div className="carte-cadre">
        <iframe
          className="carte-carte"
          src={src}
          title={`Carte Google Maps du point analysé : ${nom}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
        <p className="carte-legende">
          Google Maps, vue satellite · point analysé {lat.toFixed(4)}, {lon.toFixed(4)}
          {echec ? ' · la mise à jour au clic est indisponible' : ' · déplacez le point par la recherche ou les coordonnées'}
        </p>
      </div>
    );
  }

  return (
    <div className="carte-cadre">
      <div className="carte-carte" ref={conteneur} aria-label={`Carte Google Maps du point analysé : ${nom}`} />
      <p className="carte-legende">
        Google Maps, vue satellite · cercle de 600 m · cliquez pour déplacer le point
      </p>
    </div>
  );
}
