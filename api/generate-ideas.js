module.exports = async (req, res) => {
  // 👉 Ajout du log pour voir si le frontend déclenche plusieurs appels par erreur
  console.log("🚀 generate-ideas appelée", new Date().toISOString());

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ... le reste de ton code ...

  // Ajustement dynamique des tokens selon le nombre d'idées
  const maxTokens = targetCount <= 5 ? 2000 : targetCount <= 10 ? 3000 : 4000;

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-2603', // 👉 On utilise le modèle versionné exact
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });
