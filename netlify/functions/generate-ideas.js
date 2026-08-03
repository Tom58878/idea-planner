// Cette fonction tourne côté SERVEUR (jamais dans le navigateur du visiteur).
// La clé Mistral reste ici, invisible depuis l'extérieur.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.MISTRAL_API_KEY; // <-- lue depuis Netlify, jamais écrite en dur ici

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Clé Mistral manquante côté serveur (variable MISTRAL_API_KEY non configurée sur Netlify)." })
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

  const systemPrompt = `Tu es un stratège de contenu senior et community manager expérimenté. Tu réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après, sans balises markdown. Le format est un objet JSON avec une clé "ideas" contenant un tableau d'objets, chacun avec exactement ces clés :
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
Génère exactement ${count || 30} idées de contenu variées et non répétitives, avec des formats différents. Chaque idée doit être un plan d'action prêt à publier, avec un hook réellement percutant (pas générique) et une structure concrète et actionnable, pas de description vague. Réponds uniquement avec l'objet JSON { "ideas": [...] }.`;

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Erreur Mistral (HTTP " + response.status + "):", errText);
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Erreur Mistral", detail: errText })
      };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error("Erreur de parsing JSON. Texte reçu de Mistral:", text);
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Réponse Mistral non-JSON", detail: text.slice(0, 500) })
      };
    }

    const ideas = Array.isArray(parsed) ? parsed : parsed.ideas;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideas })
    };
  } catch (e) {
    console.error("Erreur serveur inattendue:", e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Erreur serveur", detail: String(e) })
    };
  }
};
