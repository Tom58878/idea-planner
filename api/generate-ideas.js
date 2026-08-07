module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé Mistral manquante côté serveur (MISTRAL_API_KEY non configurée).' });
  }

  const payload = req.body || {};
  const { niche, platforms, tone, count, focus } = payload;

  if (!niche || !platforms || !platforms.length) {
    return res.status(400).json({ error: 'Niche et plateformes requises.' });
  }

  const targetCount = parseInt(count, 10) || 1;

  const focusInstruction =
    focus === 'balanced' || !focus
      ? "Équilibre les piliers sur l'ensemble des idées, environ 40% Éducation, 20% Storytelling, 20% Vente, 20% Viralité."
      : `Toutes les idées doivent être du pilier "${focus}" exclusivement.`;

  const systemPrompt = `Tu es un stratège de contenu senior et community manager expérimenté. Tu réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après, sans balises markdown. Le format est un objet JSON avec une clé "ideas" contenant un tableau d'objets, chacun avec exactement ces clés :
- "pillar" (string, un parmi : "Éducation", "Storytelling", "Vente", "Viralité")
- "hook" (string, la phrase d'accroche EXACTE à copier-coller en début de post/vidéo, percutante, en français)
- "concept" (string, 1-2 phrases expliquant l'angle et le sujet du contenu)
- "structure" (tableau de 3 à 4 strings, chacune une étape/slide concrète du contenu, ex: "Slide 1 : ...")
- "format" (string, très court, ex: "Carrousel 5 slides", "Vidéo face caméra 30s", "Post texte + image")
- "cta" (string, la phrase de call-to-action exacte à mettre en fin de post, en français)
- "platforms" (tableau de strings parmi celles fournies)`;

  const userPrompt = `Niche : ${niche}
Plateformes ciblées : ${platforms.join(', ')}
Ton souhaité : ${tone || 'Fun et décontracté'}
${focusInstruction}
Génère exactement ${targetCount} idées de contenu variées et non répétitives, avec des formats différents. Chaque idée doit être un plan d'action prêt à publier, avec un hook réellement percutant (pas générique) et une structure concrète et actionnable, pas de description vague. Réponds uniquement avec l'objet JSON { "ideas": [...] }.`;

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        max_tokens: 3500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'Erreur Mistral', detail: errText });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      return res.status(502).json({ error: 'Réponse Mistral non-JSON', detail: text.slice(0, 500) });
    }

    const ideas = Array.isArray(parsed) ? parsed : parsed.ideas;

    return res.status(200).json({ ideas });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur', detail: String(e) });
  }
};
