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
    focusInstruction = "Génère une seule et unique idée de contenu au total (1 seule carte). Choisis le pilier le plus stratégique pour cette niche.";
  } else if (focus === 'balanced' || !focus) {
    focusInstruction = "Équilibre parfaitement les piliers sur l'ensemble des idées (environ 40% Éducation, 20% Storytelling, 20% Vente, 20% Viralité).";
  } else {
    focusInstruction = `Toutes les idées doivent être axées exclusivement sur le pilier "${focus}".`;
  }

  const systemPrompt = `Tu es un stratège de contenu senior, copywriter expert et community manager haut de gamme.
Ton rôle est de fournir des plans de contenu ultra-détaillés, prêts à tourner ou à rédiger immédiatement. Pas de généralités, pas de phrases vagues.

Tu réponds UNIQUEMENT en JSON valide, sans texte d'introduction ni de conclusion, sans balises markdown.
Le format est un objet JSON : { "ideas": [...] } contenant exactement ${targetCount} objet(s).

Chaque objet dans le tableau "ideas" doit avoir très exactement ces clés :
- "pillar" : (string) Un parmi strictement : "Éducation", "Storytelling", "Vente", "Viralité".
- "hook" : (string) L'accroche EXACTE (3 premières secondes / 1re ligne). Doit utiliser un levier psychologique fort (rupture de motif, chiffre choc, question provocante, promesse directe).
- "concept" : (string) Explication claire (2 à 3 phrases) de l'angle d'attaque, du contexte et de la valeur apportée au spectateur.
- "structure" : (tableau de 3 à 5 strings) Le découpage pas-à-pas ultra-précis du contenu.
  * Pour une vidéo : découpage chronologique (ex: "0-3s : Hook visuel + phrase d'accroche", "3-15s : Le problème mal compris", "15-30s : La solution en 2 étapes").
  * Pour un carrousel : découpage slide par slide (ex: "Slide 1 : Titre + accroche", "Slide 2-3 : Les 2 erreurs", "Slide 4 : La méthode alternative").
- "format" : (string) Format exact et précis (ex: "Reel / TikTok face caméra (30-45s)", "Carrousel 5 slides", "Post texte long + image").
- "cta" : (string) La phrase exacte de Call-To-Action à dire ou écrire à la fin.
- "platforms" : (tableau de strings) Les plateformes adaptées parmi celles fournies dans la demande.`;

  const userPrompt = `Détails de la demande :
- Niche / Sujet : ${niche}
- Plateformes : ${platforms.join(', ')}
- Ton de communication : ${tone || 'Fun et décontracté'}
- Recommandation d'objectif : ${focusInstruction}

Consignes impératives :
1. Génère exactement ${targetCount} idée(s) complète(s) et non répétitives.
2. Chaque carte doit être un chef-d'œuvre de copywriting : l'accroche (hook) doit donner immédiatement envie de lire/regarder.
3. La structure doit donner la feuille de route exacte pour créer le contenu sans réfléchir.
4. Réponds STRICTEMENT au format JSON { "ideas": [...] }.`;

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
