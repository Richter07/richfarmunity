const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const ADMIN_WHATSAPP = "2290146471497";

function verificationMessage(name: string, userId: string) {
  return `Bonjour, je viens de payer 2000F pour le badge vérifié sur Rich Farm Unity. Je suis prêt pour la vérification. Mon nom : ${name || "Utilisateur"} - Mon ID : ${userId}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.user_id || "test-user");
    const userName = String(body.user_name || "Utilisateur").trim();
    const secret = Deno.env.get("FEDAPAY_SECRET_KEY");
    if (!secret) throw new Error("FEDAPAY_SECRET_KEY manquant sur Supabase");

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/payer-badge-callback`;
    const whatsappRedirect = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(verificationMessage(userName, userId))}`;
    const response = await fetch("https://api.fedapay.com/v1/transactions/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Badge vérifié Rich Farm Unity",
        amount: 2000,
        currency: { iso: "XOF" },
        callback_url: webhookUrl,
        return_url: whatsappRedirect,
        custom_metadata: { user_id: userId, user_name: userName }
      })
    });
    const created = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(created));

    const transactionId = created?.["v1/transaction"]?.id || created?.id || created?.transaction?.id;
    if (!transactionId) throw new Error("Identifiant de transaction FedaPay manquant");
    const tokenResponse = await fetch(`https://api.fedapay.com/v1/transactions/${transactionId}/token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(JSON.stringify(tokenData));
    const paymentUrl = tokenData?.url || tokenData?.token?.url;
    if (!paymentUrl) throw new Error("URL de paiement FedaPay manquante");

    return new Response(JSON.stringify({ url: paymentUrl, payment_url: paymentUrl, whatsapp_redirect: whatsappRedirect }), { headers: cors });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({
      error: "Paiement échoué, réessayez",
      warning: String(error)
    }), { status: 502, headers: cors });
  }
});
