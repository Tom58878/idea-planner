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

  // 🔒 Sécurité : On autorise uniquement les quotas officiels des packs (1, 5 ou 14)
  const requestedCount = parseInt(count, 10) || 1;
  const allowedCounts = [1, 5, 14];
  const targetCount = allowedCounts.includes(requestedCount) ? requestedCount : 1;

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
   Évite absolument les titres génériques (ex: "5 conseils pour..."). Utilise des leviers psychologiques forts.

5. ANTI-CONTENU GÉNÉRIQUE :
   Ne génère JAMAIS d'idées vagues. Chaque idée doit avoir un angle précis, une situation concrète et une valeur claire et actionnable pour l'audience.

6. PLATEFORMES ET ADAPTATION INTELLIGENTE (SENS > FORMAT) :
   - Limite strictement les idées aux plateformes demandées : [${platforms.join(', ')}].
   - RÈGLE ABSOLUE : N'adapte pas seulement le format, adapte le SENS. Le sujet initial (ex: un jeu vidéo, un loisir) n'est qu'un point de départ.
   
   MÉTHODE DE TRAITEMENT OBLIGATOIRE :
   - SUJET → AUDIENCE CIBLE → ANGLE STRATÉGIQUE → VALEUR MÉTIER → CONTENU.
   - Pour LinkedIn : Interdiction absolue de faire un guide ou un conseil sur le loisir lui-même. Tu dois OBLIGATOIREMENT l'utiliser comme une métaphore, un miroir ou un cas d'école business (management, stratégie, leadership, négociation).
   
   EXEMPLE CONCRET POUR LINKEDIN :
   - ❌ MAUVAIS : "Comment optimiser sa stratégie dans Civilization 5."
   - ✔️ BON : "Ce que la gestion des alliances dans Civilization 5 nous apprend sur la négociation avec les parties prenantes en entreprise."
   
   CONTEXTES DE CONSOMMATION PAR PLATEFORME :
   - LinkedIn : Professionnel, expertise, retour d'expérience, business, management, carrière, réflexion.
   - TikTok : Accroche immédiate, divertissement, émotion, curiosité, démonstration rapide.
   - Instagram : Visuel, inspiration, pédagogie rapide, storytelling, identité de marque.
   - YouTube : Profondeur, analyse, démonstration, narration.

7. CONCISION OBLIGATOIRE (IMPORTANT) :
   Pour rester dans la limite de longueur de réponse, garde le "concept" à 1 phrase courte, et la "structure" à exactement 3 étapes courtes (une ligne chacune). Ne rallonge pas inutilement.

   8. INTÉGRITÉ DU TEXTE :
   - Chaque phrase DOIT être complète et grammaticalement terminée.
   - Ne coupe JAMAIS une phrase, un mot ou une idée en cours.
   - Chaque hook, concept, étape et CTA doit être autonome et terminé.
   - Si tu manques de place, raccourcis les phrases AVANT de les couper.
   - Il est strictement interdit de terminer un champ par "..." ou par une phrase incomplète.
   
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

  const userPrompt = `Génère exactement ${targetCount} idée(s) ultra-qualitative(s) mais CONCISES pour la niche "${niche}" avec le ton "${tone}" et l'objectif "${isBalanced ? 'Équilibré' : objective}". Respecte scrupuleusement le format JSON { "ideas": [...] } et la règle de concision (structure en 3 étapes courtes).`;

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        max_tokens: 7000,
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
    const finishReason = data.choices?.[0]?.finish_reason;
    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      // La réponse a probablement été coupée avant la fin (JSON incomplet)
      return res.status(502).json({
        error: finishReason === 'length'
          ? 'La réponse a été coupée avant la fin (trop longue). Réessaie avec moins d\'idées ou réessaie simplement.'
          : 'Format JSON invalide',
        detail: text.slice(0, 500)
      });
    }

    const rawIdeas = Array.isArray(parsed) ? parsed : (parsed.ideas || []);

    if (rawIdeas.length === 0) {
      return res.status(502).json({ error: 'Aucune idée générée, réessaie.' });
    }

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
        tone: tone || idea.tone || 'Fun et décontracté',
        platforms: platforms // on force les plateformes réellement choisies, on ne fait plus confiance à l'IA sur ce point
      };
    });

    return res.status(200).json({ ideas });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur', detail: String(e) });
  }
};

// Autorise un peu plus de temps d'exécution si le forfait Vercel le permet (sans effet sinon)
module.exports.config = { maxDuration: 30 };
