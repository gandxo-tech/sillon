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

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cle}`,
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

    if (!r.ok) {
      res.status(502).json({ erreur: `Service IA indisponible (${r.status}).` });
      return;
    }

    const j = await r.json();
    const reponse = (j?.choices?.[0]?.message?.content || '').trim();
    if (!reponse) {
      res.status(502).json({ erreur: 'Réponse vide du service IA.' });
      return;
    }
    res.status(200).json({ reponse });
  } catch (e) {
    res.status(502).json({ erreur: 'Erreur réseau vers le service IA.' });
  }
}
