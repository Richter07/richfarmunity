const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const KNOWN_WORDS = ["bonjour", "hello", "salut", "vendre", "acheter", "prix", "mais", "maïs", "corn", "sell", "buy"];
const ABBREVIATIONS: Record<string, string> = { bjr: "bonjour", slt: "salut", cc: "bonjour", comen: "comment" };

function normalizeQuestion(value: string) {
  let normalized = value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/(.)\1+/gu, "$1").replace(/\s+/g, " ").trim();
  normalized = normalized.split(" ").map(word => ABBREVIATIONS[word] || word).join(" ");
  return normalized;
}

function levenshtein(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temporary = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = temporary;
    }
  }
  return row[b.length];
}

function correctKnownWords(question: string) {
  return normalizeQuestion(question).split(" ").map(word => {
    let best = word;
    let bestSimilarity = 0;
    for (const known of KNOWN_WORDS) {
      const distance = levenshtein(word, known);
      const similarity = 1 - distance / Math.max(word.length, known.length, 1);
      if (similarity >= 0.8 && similarity > bestSimilarity) { best = known; bestSimilarity = similarity; }
    }
    return best;
  }).join(" ");
}

function detectLanguage(question: string) {
  if (/\p{Script=Han}/u.test(question)) return "chinois";
  if (/\b(the|how|sell|corn|hello|hi|please|buy|price|of course)\b/i.test(question)) return "anglais";
  return "francais";
}

function naturalFallback(question: string, language: string) {
  const normalized = normalizeQuestion(question);
  if (/fondateur|founder|创始/.test(normalized) || /founder|创始人/.test(question)) {
    if (language === "anglais") return "The founder of Rich Farm Unity is Richter TCHOHOUNGBO.";
    if (language === "chinois") return "Rich Farm Unity 的创始人是 Richter TCHOHOUNGBO。";
    return "Le fondateur de Rich Farm Unity est Richter TCHOHOUNGBO.";
  }
  if (language === "anglais") {
    if (/sell|corn/.test(normalized)) return "Of course! To sell corn, click the green Sell button, add your product details and price, then publish. Buyers can contact you on WhatsApp.";
    if (/hello|hi/.test(normalized)) return "Hello! I'm Rĩch, ready to help you with selling, buying, market prices, or your verified badge.";
    return "Of course, I'm here to help! What would you like to know about selling, buying, market prices, or the 2000F verified badge?";
  }
  if (language === "chinois") {
    if (/玉米|卖/.test(question)) return "当然可以！要卖玉米，请点击绿色的“出售”按钮，填写产品和价格，然后发布。买家可以通过 WhatsApp 联系你。";
    return "你好！我是 Rĩch，很高兴和你聊天。你想了解出售、购买、市场价格，还是 2000F 认证徽章？";
  }
  if (/vendre|maïs/.test(normalized)) return "Bien sûr ! Pour vendre du maïs, clique sur le bouton vert Vendre, renseigne ton produit, son prix et sa quantité, puis publie. Les acheteurs pourront te contacter sur WhatsApp.";
  if (/non/.test(normalized)) return "D'accord ! Nous pouvons passer à autre chose. Veux-tu vendre, acheter ou consulter les prix du marché ?";
  if (/bonjour|salut/.test(normalized)) return "Bonjour ! Je suis Rĩch, ravi d'échanger avec toi. Veux-tu vendre, acheter ou consulter les prix du marché ?";
  if (/on peut parler/.test(normalized)) return "Bien sûr qu'on peut parler ! 😊 Tu veux vendre ou acheter aujourd'hui ?";
  return "Bien sûr ! Je suis là pour échanger avec toi. Veux-tu vendre, acheter, consulter les prix du marché ou le badge vérifié à 2000F ?";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: { question?: unknown } = {};
  try { body = await req.json(); } catch { body = {}; }

  const rawQuestion = String(body.question || "").trim().replace(/#[\wÀ-ÿ]+/g, "").trim();
  const correctedQuestion = correctKnownWords(rawQuestion);
  const language = detectLanguage(rawQuestion);
  const hasLetters = /\p{L}/u.test(correctedQuestion);
  const isOnlyNumbers = /^\d+$/.test(correctedQuestion);
  const isInvalid = !correctedQuestion || correctedQuestion.length > 2000 || !hasLetters || isOnlyNumbers;
  const question = isInvalid ? "" : correctedQuestion;
  const fallbackLanguage = question ? language : "francais";
  if (isInvalid) return new Response(JSON.stringify({ reponse: naturalFallback("", fallbackLanguage) }), { headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ reponse: naturalFallback(question, language) }), { headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });

  const prompt = `Détecte la langue du message et réponds ENTIÈREMENT dans cette même langue. Si le message est en anglais, réponds 100% en anglais, jamais de mot français. Si en français, 100% en français. Si en chinois, 100% en chinois.
L'utilisateur peut faire des fautes de frappe, des fautes d'orthographe, oublier les accents. Corrige mentalement et réponds normalement, ne corrige jamais l'utilisateur, ne dis jamais 'tu as fait une faute'.
Tu es Rĩch, assistant Rich Farm Unity.
Tu discutes normalement comme ChatGPT, 2-4 phrases, amical.
Contexte: vendre = bouton vert Vendre, acheter = cliquer produit + WhatsApp, prix = onglet Prix du marché, badge = 2000F vérifié.
Connaissances officielles prioritaires, à utiliser sans les inventer ni les contredire :
- Fondateur et créateur : Richter TCHOHOUNGBO, du Bénin.
- Objectif : connecter directement les producteurs agricoles du Bénin avec les acheteurs, sans intermédiaire, avec les vrais prix du marché, des formations, des forums et des comptes vérifiés pour la confiance.
- Producteur : publie ses récoltes gratuitement, consulte les prix, gagne en visibilité avec le Compte Vérifié.
- Acheteur : trouve des offres partout au Bénin, identifie les profils vérifiés et contacte directement le vendeur sur WhatsApp.
- Visiteur : explore les annonces, prix, formations et forums sans engagement, puis crée un compte pour participer.
- Le Badge vérifié confirme qu'il s'agit d'une personne réelle et de confiance, vérifiée par Rich Farm Unity. La demande coûte 2000 F dans Mon compte.
- Pages officielles : Accueil, Annonces, Prix du marché, Calendrier culturel, Carte, Formations, Forums, Ancrage institutionnel, À propos, Fonctionnement, Modération, Suggestions, Membres, Statistiques, Mon compte, Conditions.
Si l'utilisateur demande le fondateur, répond exactement en français : "Le fondateur de Rich Farm Unity est Richter TCHOHOUNGBO." en adaptant uniquement la langue de la réponse demandée.
Reste concis, utile et emploie les vrais noms des pages.
Message: ${question}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || JSON.stringify(data));
    const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("").trim();
    if (!text) throw new Error("Réponse vide de Gemini");
    return new Response(JSON.stringify({ reponse: text }), { headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ reponse: naturalFallback(question, language), google_error: String(error) }), { headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
  }
});