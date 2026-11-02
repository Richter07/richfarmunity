import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const TAVILY_KEY = Deno.env.get("TAVILY_API_KEY");

  const produits = ["Maïs", "Riz", "Tomate", "Oignon", "Sorgho"];
  const limiteAncienne = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { error: erreurSuppression } = await supabase
    .from("prix_marche")
    .delete()
    .is("user_id", null)
    .lt("created_at", limiteAncienne);
  if (erreurSuppression) {
    return new Response(JSON.stringify({ ok: false, error: erreurSuppression.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  for (const nom of produits) {
    try {
      // Recherche réelle
      const tRes = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_KEY,
          query: `prix ${nom} kg marché Bénin FCFA aujourd'hui min max`,
          search_depth: "advanced",
          include_answer: true,
          max_results: 5
        })
      });
      const tData = await tRes.json();
      const texte = (tData.answer || "") + " " + (tData.results?.map((r:any)=>r.content).join(" ") || "");
      
      // On cherche 2 prix dans le texte: ex "300 à 500 FCFA"
      const chiffres = [...texte.matchAll(/(\d{2,4})\s*(?:à|-|et)\s*(\d{2,4})\s*F/gi)];
      let prix_min = 0, prix_max = 0;
      
      if (chiffres.length > 0) {
        prix_min = parseInt(chiffres[0][1]);
        prix_max = parseInt(chiffres[0][2]);
      } else {
        // Si un seul prix trouvé
        const unPrix = texte.match(/(\d{2,4})\s*FCFA/i);
        if (unPrix) {
          prix_min = parseInt(unPrix[1]);
          prix_max = Math.round(prix_min * 1.3);
        }
      }

      // Si on a trouvé un vrai prix, on insère comme un utilisateur
      if (prix_min > 50 && prix_max > prix_min) {
        if (prix_max > prix_min * 3) prix_max = Math.round(prix_min * 1.5); // sécurité marge
        
        await supabase.from("prix_marche").insert({
          produit: nom,
          categorie: "Céréales",
          filiere: "Production végétale",
          prix_min: prix_min,
          prix_max: prix_max,
          unite: "kg",
          departement: "Atlantique",
          approuve: false,  // comme un vrai utilisateur, en attente
          rejete: false
        });
        console.log(`OK ${nom}: ${prix_min} - ${prix_max}`);
      } else {
        console.log(`Pas de prix trouvé pour ${nom}`);
      }
    } catch (e) {
      console.log(e);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});