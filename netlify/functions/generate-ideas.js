// Cette fonction tourne côté SERVEUR (jamais dans le navigateur du visiteur).
// La clé Gemini reste ici, invisible depuis l'extérieur.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.GEMINI_API_KEY; // <-- lue depuis Netlify, jamais écrite en dur ici

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Clé Gemini manquante côté serveur (variable GEMINI_API_KEY non configurée sur Netlify)." })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Corps de requête invalide." }) };
  }

  const { niche, platforms, tone, count, focus } = payload;

  if (!niche || !platforms || !platforms.length) {
    return { statusCode: 400, body: JSON.stringify({ error: "Niche et plateformes requises." }) };
  }

  const focusInstruction =
    focus === "balanced" || !focus
      ? "Équilibre les piliers sur l'ensemble des idées, environ 40% Éducation, 20% Storytelling, 20% Vente, 20% Viralité."
      : `Toutes les idées doivent être du pilier "${focus}" exclusivement.`;

  const systemPrompt = `Tu es un stratège de contenu senior et community manager expérimenté. Tu réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après, sans balises markdown. Le format est un tableau JSON d'objets avec exactement ces clés :
- "pillar" (string, un parmi : "Éducation", "Storytelling", "Vente", "Viralité")
- "hook" (string, la phrase d'accroche EXACTE à copier-coller en début de post/vidéo, percutante, en français)
- "concept" (string, 1-2 phrases expliquant l'angle et le sujet du contenu)
- "structure" (tableau de 3 à 4 strings, chacune une étape/slide concrète du contenu, ex: "Slide 1 : ...")
- "format" (string, très court, ex: "Carrousel 5 slides", "Vidéo face caméra 30s", "Post texte + image")
- "cta" (string, la phrase de call-to-action exacte à mettre en fin de post, en français)
- "platforms" (tableau de strings parmi celles fournies)`;

  const userPrompt = `Niche : ${niche}
Plateformes ciblées : ${platforms.join(", ")}
Ton souhaité : ${tone || "Fun et décontracté"}
${focusInstruction}
Génère exactement ${count || 30} idées de contenu variées et non répétitives, avec des formats différents. Chaque idée doit être un plan d'action prêt à publier, avec un hook réellement percutant (pas générique) et une structure concrète et actionnable, pas de description vague. Réponds uniquement avec le tableau JSON.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }]
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return { statusCode: 502, body: JSON.stringify({ error: "Erreur Gemini", detail: errText }) };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const ideas = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideas })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Erreur serveur", detail: String(e) }) };
  }
};
