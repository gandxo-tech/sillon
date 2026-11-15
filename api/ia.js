/**
 * Conseil IA de Sillon — POST uniquement.
 *
 * Deux leçons apprises en production :
 *  - la variable peut contenir une note collée avec la clé : on ne garde que
 *    le premier mot, sinon l'en-tête d'autorisation est invalide ;
 *  - un identifiant de modèle codé en dur finit par être retiré par le
 *    fournisseur (404). On demande donc la liste réellement disponible avec
 *    la clé du projet, puis on prend le premier modèle d'une liste de
 *    préférence.
 *
 * Aucun message d'erreur ne recopie l'en-tête ni la clé : cette réponse est
 * publique.
 */

const MODELE_PREFERE = [
  'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'qwen/qwen3-32b',
];

async function choisirModele(cle) {
  const r = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${cle}` },
  });
  if (!r.ok) return { modele: null, statut: r.status };
  const j = await r.json();
  const disponibles = new Set((j && j.data ? j.data : []).map((m) => m.id));
  const modele = MODELE_PREFERE.find((m) => disponibles.has(m)) || null;
  return { modele, statut: r.status, nombre: disponibles.size };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ erreur: 'Méthode non autorisée' });
    return;
  }

  // GROK_KEY est le nom utilisé sur ce projet ; GROQ_API_KEY reste accepté.
  const cle = String(process.env.GROK_KEY || process.env.GROQ_API_KEY || '')
    .trim()
    .split(/\s+/)[0];
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

  let choix;
  try {
    choix = await choisirModele(cle);
  } catch (e) {
    console.error('Groq injoignable (liste des modèles)', (e && e.name) || 'réseau');
    res.status(502).json({ erreur: 'Service IA injoignable (réseau).' });
    return;
  }

  if (!choix.modele) {
    console.error('Aucun modèle disponible', choix.statut, choix.nombre);
    res.status(502).json({
      erreur: `Aucun modèle disponible pour cette clé (statut ${choix.statut}).`,
    });
    return;
  }

  let r;
  try {
    r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cle}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: choix.modele,
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
    const message = String((e && e.message) || '');
    const motif = /invalid header/i.test(message) ? 'clé API mal formée' : 'réseau';
    console.error('Groq injoignable (conseil)', motif);
    res.status(502).json({ erreur: `Service IA injoignable (${motif}).` });
    return;
  }

  if (!r.ok) {
    let code = '';
    try {
      const corps = await r.json();
      code = (corps && corps.error && corps.error.code) || '';
    } catch {
      code = '';
    }
    console.error('Groq a répondu', r.status, code);
    res.status(502).json({ erreur: `Service IA indisponible (${r.status}${code ? ` ${code}` : ''}).` });
    return;
  }

  let j;
  try {
    j = await r.json();
  } catch (e) {
    console.error('Réponse Groq illisible');
    res.status(502).json({ erreur: 'Réponse illisible du service IA.' });
    return;
  }

  const reponse = (j && j.choices && j.choices[0] && j.choices[0].message
    ? j.choices[0].message.content
    : ''
  ).trim();

  if (!reponse) {
    console.error('Réponse Groq vide');
    res.status(502).json({ erreur: 'Réponse vide du service IA.' });
    return;
  }

  res.status(200).json({ reponse, modele: choix.modele });
}
