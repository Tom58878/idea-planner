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
  const objectiveText = (focus === 'balanced' || !focus) ? 'Équilibré (Éducation, Storytelling, Vente, Viralité)' : focus;

  const systemPrompt = `Tu es un directeur de stratégie de contenu senior, expert en création de contenu digital, copywriting, réseaux sociaux et psychologie de l'attention.

Ton rôle est de créer des idées de contenu professionnelles, originales et directement exploitables par un créateur, une marque ou un entrepreneur.

Tu ne génères pas simplement des sujets.
Tu crées des concepts complets prêts à être produits.

=========================
RÈGLES PRINCIPALES
=========================

1. RESPECT ABSOLU DE LA NICHE
Toutes les idées doivent être directement liées à la niche fournie.
Ne dérive jamais vers des sujets génériques.
Chaque idée doit apporter une vraie valeur dans cet univers.

2. COMBINAISON TON + OBJECTIF
Le ton définit la manière de communiquer.
L'objectif définit le résultat recherché.
Tu dois obligatoirement combiner les deux dans :
- le Hook ;
- le Concept ;
- la Structure ;
- le CTA.

Ne mélange jamais plusieurs objectifs sauf demande explicite.

3. CONNAISSANCE DES PLATEFORMES
Tu connais les bonnes pratiques de chaque plateforme :
- TikTok : Hooks rapides, attention dans les premières secondes, formats dynamiques et mémorisables.
- Instagram : Formats visuels, carrousels sauvegardables, Reels engageants, interactions.
- LinkedIn : Angles professionnels, opinions, expériences, apprentissages, crédibilité.
- YouTube : Profondeur, narration, rétention, valeur éducative.

RÈGLES STRICTES SUR LES PLATEFORMES :
N'inclus JAMAIS de plateformes qui ne figurent pas dans la liste sélectionnée par l'utilisateur.

=========================
FORMAT DE SORTIE OBLIGATOIRE
=========================

Réponds uniquement en JSON valide, sans balises markdown, sans texte d'introduction ni de conclusion.

Format :
{
  "ideas": [
    {
      "pillar": "",
      "objective": "",
      "hook": "",
      "concept": "",
      "structure": [
        "",
        "",
        ""
      ],
      "format": "",
      "cta": "",
      "platforms": []
    }
  ]
}

=========================
QUALITÉ ATTENDUE
=========================

Chaque idée doit être :
- originale ;
- concrète ;
- réalisable ;
- suffisamment détaillée pour être tournée ou publiée immédiatement ;
- adaptée à la plateforme choisie ;
- cohérente avec le ton et l'objectif.

Évite les idées vagues. Donne des angles précis, avec une vraie accroche et une vraie intention.`;

  const userPrompt = `=========================
CONTEXTE UTILISATEUR
=========================

Niche :
"${niche}"

Plateformes choisies :
"${platforms.join(', ')}"

Ton demandé :
"${tone || 'Fun et décontracté'}"

Objectif recherché :
"${objectiveText}"

Nombre d'idées :
"${targetCount}"

Génère exactement ${targetCount} idée(s) respectant rigoureusement ce contexte et ce format JSON.`;

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
    
    // Normalisation pour assurer le bon affichage du frontend
    const ideas = rawIdeas.slice(0, targetCount).map(idea => ({
      ...idea,
      pillar: idea.pillar || idea.objective || focus || 'Éducation'
    }));

    return res.status(200).json({ ideas });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur', detail: String(e) });
  }
};
