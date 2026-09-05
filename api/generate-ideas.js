module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé Mistral manquante côté serveur.' });
  }

  const payload = req.body || {};
  const { niche, platforms, tone, count, objective } = payload;

  if (!niche || !platforms || !platforms.length) {
    return res.status(400).json({ error: 'Niche et plateformes requises.' });
  }

  const targetCount = parseInt(count, 10) || 1;
  const isBalanced = !objective || objective === 'balanced';

  let objectiveInstruction = "";
  if (isBalanced) {
    objectiveInstruction = "Répartis et équilibre les objectifs sur l'ensemble des cartes de manière variée parmi : 'Éducation / Expertise', 'Storytelling / Confiance', 'Vente / Conversion', 'Viralité / Engagement'.";
  } else {
    objectiveInstruction = `RÈGLE ABSOLUE : L'objectif de TOUTES les cartes générées DOIT ÊTRE STRICTEMENT ET UNIQUEMENT "${objective}". L'interdiction est totale de changer d'objectif.`;
  }

  const systemPrompt = `Tu es un directeur de stratégie de contenu senior, expert en copywriting, réseaux sociaux et psychologie de l'attention. Tu réponds UNIQUEMENT en JSON valide, sans balises markdown, sans texte d'introduction ni de conclusion.

RÈGLES DE GÉNÉRATION :
1. NICHE : "${niche}"
2. TON : "${tone || 'Fun et décontracté'}"
3. OBJECTIF : ${objectiveInstruction}
4. CONCISION : Concept à 1 phrase courte, structure à exactement 3 étapes courtes.

Format JSON obligatoire :
{
  "ideas": [
    {
      "objective": "",
      "tone": "",
      "hook": "",
      "concept": "",
      "structure": ["Étape 1...", "Étape 2...", "Étape 3..."],
      "format": "",
      "cta": "",
      "platforms": []
    }
  ]
}`;

  const userPrompt = `Génère exactement ${targetCount} idée(s) pour la niche "${niche}" avec le ton "${tone}".`;

  // Ajustement dynamique des tokens selon le nombre d'idées demandées
  const maxTokens = targetCount <= 5 ? 2000 : targetCount <= 10 ? 3000 : 4000;

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: response.status === 429 ? 'Limite de requêtes Mistral atteinte (Rate Limit).' : 'Erreur API Mistral',
        detail: errText
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed = JSON.parse(clean);
    const rawIdeas = Array.isArray(parsed) ? parsed : (parsed.ideas || []);

    const ideas = rawIdeas.slice(0, targetCount).map((idea, index) => ({
      ...idea,
      tone: tone || idea.tone || 'Fun et décontracté',
      platforms: platforms
    }));

    return res.status(200).json({ ideas });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur', detail: String(e) });
  }
};

module.exports.config = { maxDuration: 30 };
