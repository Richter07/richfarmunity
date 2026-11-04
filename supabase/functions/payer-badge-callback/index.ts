import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };
Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const transaction = payload.transaction || payload.data?.transaction || payload.data || payload;
    const status = String(transaction.status || payload.status || "").toLowerCase();
    const userId = transaction.custom_id || transaction.metadata?.user_id || payload.custom_id || payload.user_id;
    if (status === "approved" && userId) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { error } = await supabase.from("profiles").update({ badge_verifie: true, badge_paye_le: new Date().toISOString() }).eq("id", userId);
      if (error) throw error;
    }
    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: jsonHeaders });
  }
});
