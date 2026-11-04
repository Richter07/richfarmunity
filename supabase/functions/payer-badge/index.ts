const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const ADMIN_WHATSAPP = "2290146471497";

function verificationMessage(name: string, userId: string) {
  return `Bonjour, je viens de payer 2000F pour le badge vérifié sur Rich Farm Unity. Je suis prêt pour la vérification. Mon nom : ${name || "Utilisateur"} - Mon ID : ${userId}`;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

    const secret = Deno.env.get("FEDAPAY_SECRET_KEY");
    if (!secret) throw new Error("FEDAPAY_SECRET_KEY manquant");

    const body = await req.json().catch(() => ({}));
    const userId = String(body.user_id || "test-user");
    const userName = String(body.user_name || "Utilisateur").trim();
    const webhookUrl = "https://eablggolxlmnquryqztp.supabase.co/functions/v1/payer-badge-callback";
    const whatsappRedirect = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(verificationMessage(userName, userId))}`;

    const response = await fetch("https://api.fedapay.com/v1/transactions", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Badge vérifié Rich Farm Unity",
        amount: 2000,
        currency: { iso: "XOF" },
        callback_url: webhookUrl,
        return_url: whatsappRedirect,
        custom_metadata: { user_id: userId, user_name: userName },
      }),
    });
    const created = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(created?.message || JSON.stringify(created));

    const transactionId = created?.["v1/transaction"]?.id || created?.id || created?.transaction?.id;
    if (!transactionId) throw new Error("Identifiant de transaction FedaPay manquant");

    const tokenResponse = await fetch(`https://api.fedapay.com/v1/transactions/${transactionId}/token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok) throw new Error(tokenData?.message || JSON.stringify(tokenData));

    const paymentUrl = tokenData?.url || tokenData?.token?.url;
    if (!paymentUrl) throw new Error("URL de paiement FedaPay manquante");

    return json({ url: paymentUrl });
  } catch (error) {
    console.error("payer-badge error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 502);
  }
});
