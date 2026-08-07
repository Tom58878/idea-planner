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

  const systemPrompt = `Tu es un directeur de stratégie de contenu senior, expert en copywriting, réseaux sociaux et psychologie de l'attention.
Tu réponds UNIQUEMENT en JSON valide, sans balises markdown, sans texte d'introduction ni de conclusion.

=========================
RÈGLES DE GÉNÉRATION
=========================

1. NICHE ABSOLUE : Le sujet est "${niche}". Tout le contenu doit y être directement lié.
2. TON EXIGÉ : Le ton demandé est "${tone || 'Fun et décontracté'}". Tu dois obligatoirement le refléter dans le hook, le concept, la structure et le CTA.
3. OBJECTIF : ${objectiveInstruction}

4. HOOKS PERCUTANTS (CRUCIAL) : 
   Le hook doit être une phrase réellement utilisable dans les 3 premières secondes d'une vidéo ou la première ligne d'un post. 
   Il doit donner une envie irrésistible de continuer. 
   Évite absolument les titres génériques (ex: "5 conseils pour..."). Utilise des leviers psychologiques forts (ex: "Tu nettoies ton visage tous les jours ? Tu fais peut-être cette erreur.").

5. ANTI-CONTENU GÉNÉRIQUE :
   Ne génère JAMAIS d'idées vagues. Chaque idée doit avoir un angle précis, une situation concrète et une valeur claire et actionnable pour l'audience.

6. PLATEFORMES ET BONNES PRATIQUES :
   - Limite strictement aux plateformes demandées : [${platforms.join(', ')}].
   - TikTok : Privilégie les hooks rapides, l'attention dans les premières secondes, les formats dynamiques et mémorisables.
   - Instagram : Privilégie les formats visuels, les carrousels sauvegardables, les Reels engageants et les interactions communautaires.
   - LinkedIn : Privilégie les angles professionnels, les opinions, les expériences, les apprentissages et la crédibilité.
   - YouTube : Privilégie la profondeur, la narration, la rétention et la valeur éducative.

Format de sortie JSON obligatoire :
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

  const userPrompt = `Génère exactement ${targetCount} idée(s) ultra-qualitative(s) pour la niche "${niche}" avec le ton "${tone}" et l'objectif "${isBalanced ? 'Équilibré' : objective}". Respecte scrupuleusement le format JSON { "ideas": [...] }.`;

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
      return res.status(502).json({ error: 'Erreur API Mistral', detail: errText });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      return res.status(502).json({ error: 'Format JSON invalide', detail: text.slice(0, 500) });
    }

    const rawIdeas = Array.isArray(parsed) ? parsed : (parsed.ideas || []);
    
    // Sécurisation absolue de la sortie
    const ideas = rawIdeas.slice(0, targetCount).map((idea, index) => {
      let assignedObj = idea.objective;
      if (!isBalanced) {
        assignedObj = objective;
      } else if (!assignedObj || assignedObj === "") {
        const mix = ['Éducation / Expertise', 'Storytelling / Confiance', 'Vente / Conversion', 'Viralité / Engagement'];
        assignedObj = mix[index % mix.length];
      }
      return {
        ...idea,
        objective: assignedObj,
        tone: tone || idea.tone || 'Fun et décontracté'
      };
    });

    return res.status(200).json({ ideas });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur', detail: String(e) });
  }
};
