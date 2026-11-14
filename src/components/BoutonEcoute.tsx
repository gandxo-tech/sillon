import { useEffect, useState } from 'react';

/** Lit le résumé à voix haute, pour qui ne lit pas couramment. */
export default function BoutonEcoute({ texte }: { texte: string }) {
  const [parle, setParle] = useState(false);
  const [dispo, setDispo] = useState(false);

  useEffect(() => {
    setDispo(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!dispo) return null;

  const basculer = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    if (parle) {
      setParle(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = 'fr-FR';
    u.rate = 0.95;
    const voix = synth.getVoices().find((v) => v.lang.startsWith('fr'));
    if (voix) u.voice = voix;
    u.onend = () => setParle(false);
    u.onerror = () => setParle(false);
    synth.speak(u);
    setParle(true);
  };

  return (
    <button
      type="button"
      className={`bouton-ecoute${parle ? ' est-actif' : ''}`}
      onClick={basculer}
      aria-pressed={parle}
    >
      {parle ? 'Arrêter la lecture' : 'Écouter le résumé'}
    </button>
  );
}