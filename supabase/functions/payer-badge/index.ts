const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(()=>({}));
    const user_id = body.user_id || "test-user";
    const secret = Deno.env.get("FEDAPAY_SECRET_KEY");
    if (!secret) return new Response(JSON.stringify({ error: "FEDAPAY_SECRET_KEY manquant sur Supabase - va dans secrets" }), { status: 400, headers: cors });

    try {
      const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/payer-badge-callback`;
      const r = await fetch("https://api.fedapay.com/v1/transactions", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Badge vérifié Rich Farm Unity", amount: 2000, currency: { iso: "XOF" }, callback_url: callbackUrl, custom_metadata: { user_id } })
      });
      const created = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(created));
      const transactionId = created?.["v1/transaction"]?.id || created?.id || created?.transaction?.id;
      const tokenR = await fetch(`https://api.fedapay.com/v1/transactions/${transactionId}/token`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
      const tokenData = await tokenR.json();
      const payment_url = tokenData?.url || tokenData?.token?.url;
      if (!payment_url) throw new Error("URL manquante: "+JSON.stringify(tokenData));
      const whatsapp_redirect = `https://wa.me/2290146471497?text=Salut%20Rich%20Farm%2C%20j'ai%20paye%20mon%20badge%202000F%20ID:${user_id}`;
      return new Response(JSON.stringify({ payment_url, whatsapp_redirect }), { headers: cors });
    } catch (fedapayError) {
      console.error(fedapayError);
      return new Response(JSON.stringify({
        payment_url: `https://wa.me/2290146471497?text=Je%20veux%20payer%20badge%202000F%20ID:${user_id}%20Erreur:${encodeURIComponent(String(fedapayError).slice(0,100))}`,
        whatsapp_redirect: `https://wa.me/2290146471497?text=Salut%20Rich%20Farm%2C%20j'ai%20paye%20mon%20badge%202000F%20ID:${user_id}`,
        warning: String(fedapayError),
        mode: "whatsapp-direct-fallback"
      }), { headers: cors });
    }
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
