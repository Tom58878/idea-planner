module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé Mistral non configurée' });
  }

  const { niche, platforms, tone, count, focus } = req.body || {};

  try {
    const prompt = `Génère ${count || 1} idées de contenu pour la niche "${niche}". Tone: ${tone}. Focus: ${focus}. Platforms: ${(platforms || []).join(', ')}. Réponds exclusivement sous forme de JSON structuré avec un tableau "ideas".`;

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
    const resultText = data.choices[0].message.content;
    const parsed = JSON.parse(resultText);

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: 'Erreur lors de la génération.' });
  }
};
