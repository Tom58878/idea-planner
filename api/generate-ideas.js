module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé Mistral manquante côté serveur.' });
  }

  const payload = req.body || {};
  const { niche, platforms, tone, count, focus } = payload;

  if (!niche || !platforms || !platforms.length) {
    return res.status(400).json({ error: 'Niche et plateformes requises.' });
  }

  const targetCount = parseInt(count, 10) || 1;

  let focusInstruction = "";
  if (targetCount === 1) {
    focusInstruction = "Génère une seule et unique idée de contenu. Choisis le pilier le plus pertinent pour la niche.";
  } else if (focus === 'balanced' || !focus) {
    focusInstruction = "Équilibre parfaitement les piliers sur l'ensemble des idées (Éducation, Storytelling, Vente, Viralité).";
  } else {
    focusInstruction = `Toutes les idées doivent appartenir exclusivement au pilier "${focus}".`;
  }

  const systemPrompt = `Tu es un stratège de contenu senior, copywriter expert et community manager haut de gamme.

CONSIGNE 1 — LA NICHE :
Le sujet exact est : "${niche}". TOUTES les idées doivent traiter DIRECTEMENT et EXCLUSIVEMENT de "${niche}". Interdiction totale de faire du hors-sujet ou de basculer sur des modèles génériques (comme la gestion de budget ou les abonnements).

CONSIGNE 2 — LE TON EXIGÉ :
Le ton à adopter obligatoirement dans les hooks, concepts et structures est : "${tone || 'Fun et décontracté'}".
- "Fun et décontracté" : style vivant, familier, punchy, avec de l'humour.
- "Expert et pédagogue" : style rigoureux, précis, axé sur l'expertise technique et la clarté.
- "Inspirant et motivant" : style émotionnel, fort, axé sur le déclic et la réussite.
- "Direct et sans filtre" : style cash, percutant, sans langue de bois.

CONSIGNE 3 — L'OBJECTIF / PILIER :
${focusInstruction}

Tu réponds UNIQUEMENT en JSON valide, sans texte d'introduction ni de conclusion, sans balises markdown.
Le format est un objet JSON : { "ideas": [...] } contenant exactement ${targetCount} objet(s).

Chaque objet dans le tableau "ideas" doit avoir très exactement ces clés :
- "pillar" : (string) Un parmi strictement : "Éducation", "Storytelling", "Vente", "Viralité".
- "hook" : (string) L'accroche EXACTE (3 premières secondes / 1re ligne) rédigée dans le ton "${tone || 'Fun et décontracté'}" et centrée sur "${niche}".
- "concept" : (string) Explication claire (2 à 3 phrases) de l'angle d'attaque et de la valeur apportée.
- "structure" : (tableau de 3 à 5 strings) Le découpage pas-à-pas ultra-précis du contenu.
- "format" : (string) Format exact et précis (ex: "Reel / TikTok face caméra (30-45s)", "Carrousel 5 slides").
- "cta" : (string) La phrase exacte de Call-To-Action.
- "platforms" : (tableau de strings) Les plateformes adaptées parmi celles fournies.`;

  const userPrompt = `Détails de la demande :
- Niche : ${niche}
- Plateformes : ${platforms.join(', ')}
- Ton : ${tone || 'Fun et décontracté'}
- Objectif / Pilier : ${focus || 'balanced'}
- Nombre d'idées : ${targetCount}

Génère exactement ${targetCount} idée(s) en respectant scrupuleusement la niche, le ton et l'objectif demandés. Réponds STRICTEMENT au format JSON { "ideas": [...] }.`;

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
      return res.status(502).json({ error: 'Format JSON invalide renvoyé par l\'IA', detail: text.slice(0, 500) });
    }

    const rawIdeas = Array.isArray(parsed) ? parsed : (parsed.ideas || []);
    const ideas = rawIdeas.slice(0, targetCount);

    return res.status(200).json({ ideas });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur', detail: String(e) });
  }
};
