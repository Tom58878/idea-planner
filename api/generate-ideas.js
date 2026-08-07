module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé Mistral non configurée' });
  }

  const { niche, platforms, tone, count, focus } = req.body || {};
  const ideasCount = parseInt(count, 10) || 1;

  try {
    const prompt = `Génère exactement ${ideasCount} idées de contenu pour la niche "${niche}".
Ton: ${tone || 'Fun et décontracté'}. Objectif: ${focus || 'Équilibré'}. Plateformes: ${(platforms || []).join(', ')}.

Tu DOIS répondre EXCLUSIVEMENT avec un objet JSON strict au format suivant :
{
  "ideas": [
    {
      "pillar": "${focus || 'Éducation'}",
      "hook": "L'accroche de la vidéo",
      "concept": "Explication du concept",
      "structure": ["Point 1", "Point 2", "Point 3"],
      "format": "Reel / TikTok",
      "cta": "Appel à l'action",
      "platforms": ${JSON.stringify(platforms || ['instagram'])}
    }
  ]
}`;

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    
    if (!data.choices || !data.choices[0]) {
      return res.status(500).json({ error: 'Réponse Mistral invalide' });
    }

    const resultText = data.choices[0].message.content;
    const parsed = JSON.parse(resultText);

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur lors de la génération.' });
  }
};
