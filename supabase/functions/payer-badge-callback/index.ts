import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };
const ADMIN_WHATSAPP = "2290146471497";
Deno.serve(async (req) => {
  try {
    let payload: any = {};
    if (req.method !== "GET") payload = await req.json().catch(() => ({}));
    const query = new URL(req.url).searchParams;
    const transaction = payload.transaction || payload.data?.transaction || payload.data || payload;
    const status = String(transaction.status || payload.status || "").toLowerCase();
    const userId = transaction.custom_id || transaction.metadata?.user_id || payload.custom_id || payload.user_id || query.get("user_id");
    const userName = transaction.metadata?.user_name || payload.user_name || query.get("user_name") || "Utilisateur";
    if (status === "approved" && userId) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { error } = await supabase.from("profiles").update({ badge_verifie: true, badge_paye_le: new Date().toISOString() }).eq("id", userId);
      if (error) throw error;
    }
    if (req.method === "GET" && status === "approved") {
      const message = `Bonjour, je viens de payer 2000F pour le badge vérifié sur Rich Farm Unity. Je suis prêt pour la vérification. Mon nom : ${userName} - Mon ID : ${userId}`;
      return Response.redirect(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`, 302);
    }
    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: jsonHeaders });
  }
});
