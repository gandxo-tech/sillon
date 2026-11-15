export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ erreur: 'Méthode non autorisée' });
    return;
  }

  // GROK_KEY est le nom utilisé sur ce projet ; GROQ_API_KEY reste accepté.
  const cle = process.env.GROK_KEY || process.env.GROQ_API_KEY;
  if (!cle) {
    res.status(503).json({
      erreur:
        'Clé API non configurée. Ajoutez GROK_KEY (ou GROQ_API_KEY) dans les variables d’environnement Vercel, pour la production et l’aperçu, puis redéployez.',
    });
    return;
  }

  const data = req.body || {};
  const contexte = String(data.contexte || '').slice(0, 4000);
  const question = String(
    data.question || 'Donne un conseil court et concret pour cette parcelle.',
  ).slice(0, 500);

  let r;
  try {
    r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cle.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content:
              'Tu es un conseiller agricole. Réponds en français, en 5 à 8 phrases courtes, sans jargon, avec une recommandation claire et les principaux risques. Tu aides à la décision, tu ne prescris pas et tu ne remplaces ni l’observation de terrain, ni le savoir-faire de l’exploitant, ni l’expertise d’un agronome. Rappelle que l’eau disponible, les limites du matériel et les débouchés du marché peuvent changer la conclusion, et signale les situations où le jugement humain est indispensable (compaction réelle, ravageurs du voisinage, qualité des semis, parc matériel, contrats, aides).',
          },
          {
            role: 'user',
            content: `Contexte parcelle :\n${contexte}\n\nQuestion : ${question}`,
          },
        ],
        temperature: 0.4,
        max_tokens: 400,
      }),
    });
  } catch (e) {
    // « TypeError » recouvre deux pannes très différentes : une valeur d'en-tête
    // refusée (clé mal collée) et un appel réseau qui échoue. On expose la cause
    // précise, elle ne contient aucun secret.
    const cause = e && e.cause ? String(e.cause.code || e.cause.message || e.cause) : '';
    const message = e && e.message ? String(e.message) : 'réseau';
    console.error('Groq injoignable', e && e.name, message, cause);
    res.status(502).json({
      erreur: `Service IA injoignable (${message}${cause ? ` / ${cause}` : ''}).`,
    });
    return;
  }

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    console.error('Groq a répondu', r.status, detail.slice(0, 300));
    res.status(502).json({ erreur: `Service IA indisponible (${r.status}).` });
    return;
  }

  let j;
  try {
    j = await r.json();
  } catch (e) {
    console.error('Réponse Groq illisible', e && e.message);
    res.status(502).json({ erreur: 'Réponse illisible du service IA.' });
    return;
  }

  const reponse = (j?.choices?.[0]?.message?.content || '').trim();
  if (!reponse) {
    console.error('Réponse Groq vide', JSON.stringify(j).slice(0, 300));
    res.status(502).json({ erreur: 'Réponse vide du service IA.' });
    return;
  }
  res.status(200).json({ reponse });
}
