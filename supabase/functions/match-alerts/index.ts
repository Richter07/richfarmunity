import { createClient } from "npm:@supabase/supabase-js@2.49.1";

type AnnouncementRecord = {
  id: string;
  titre: string;
  description: string | null;
  categorie: string;
  localisation: string | null;
  departement: string | null;
  approuve: boolean | null;
  rejete: boolean | null;
};

type SearchAlert = {
  id: string;
  user_id: string;
  mot_cle: string | null;
  categorie: string | null;
  departement: string | null;
};

type DatabaseWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: AnnouncementRecord | null;
};

type NotificationInsert = {
  user_id: string;
  alerte_id: string;
  annonce_id: string;
};

const PAGE_SIZE = 1000;

function matchesIlike(value: string, pattern: string): boolean {
  const expression = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, ".*")
    .replace(/_/g, ".");
  return new RegExp(`^${expression}$`, "isu").test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchesAlert(alert: SearchAlert, announcement: AnnouncementRecord): boolean {
  const searchableText = `${announcement.titre} ${announcement.description ?? ""}`;

  if (alert.mot_cle && !matchesIlike(searchableText, `%${alert.mot_cle}%`)) {
    return false;
  }
  if (alert.categorie && alert.categorie !== announcement.categorie) {
    return false;
  }
  if (alert.departement) {
    const departmentPattern = `%${alert.departement}%`;
    const matchesDepartment = [
      announcement.departement,
      announcement.localisation,
    ].some((value) => value && matchesIlike(value, departmentPattern));
    if (!matchesDepartment) return false;
  }
  return true;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const webhookSecret = Deno.env.get("MATCH_ALERTS_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error("Required match-alerts function secrets are missing");
    return Response.json({ error: "Function is not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${webhookSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch (error) {
    console.error("Invalid webhook JSON", error);
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!isRecord(rawPayload)) {
    return Response.json({ error: "Expected a webhook object" }, { status: 400 });
  }
  const payload = rawPayload as DatabaseWebhookPayload;
  if (payload.schema !== "public" || payload.table !== "publications" ||
    (payload.type !== "INSERT" && payload.type !== "UPDATE")) {
    return Response.json({ error: "Expected a public.publications INSERT or UPDATE event" }, { status: 400 });
  }

  const rawAnnouncement = payload.record;
  if (!isRecord(rawAnnouncement) ||
    typeof rawAnnouncement.id !== "string" ||
    typeof rawAnnouncement.titre !== "string" ||
    typeof rawAnnouncement.categorie !== "string" ||
    (rawAnnouncement.description !== null && typeof rawAnnouncement.description !== "string") ||
    (rawAnnouncement.localisation !== null && typeof rawAnnouncement.localisation !== "string") ||
    (rawAnnouncement.departement !== null && typeof rawAnnouncement.departement !== "string") ||
    (rawAnnouncement.approuve !== null && typeof rawAnnouncement.approuve !== "boolean") ||
    (rawAnnouncement.rejete !== null && typeof rawAnnouncement.rejete !== "boolean")) {
    return Response.json({ error: "Webhook record is missing required announcement fields" }, { status: 400 });
  }
  const announcement: AnnouncementRecord = {
    id: rawAnnouncement.id,
    titre: rawAnnouncement.titre,
    description: rawAnnouncement.description,
    categorie: rawAnnouncement.categorie,
    localisation: rawAnnouncement.localisation,
    departement: rawAnnouncement.departement,
    approuve: rawAnnouncement.approuve,
    rejete: rawAnnouncement.rejete,
  };

  if (announcement.approuve !== true || announcement.rejete === true) {
    return Response.json({
      status: "ignored",
      reason: "Announcement is not approved for publication",
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const alerts: SearchAlert[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("alertes_recherche")
      .select("id, user_id, mot_cle, categorie, departement")
      .eq("actif", true)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("Could not load active search alerts", error);
      return Response.json({ error: "Could not load active alerts" }, { status: 500 });
    }
    alerts.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const notifications: NotificationInsert[] = alerts
    .filter((alert) => matchesAlert(alert, announcement))
    .map((alert) => ({
      user_id: alert.user_id,
      alerte_id: alert.id,
      annonce_id: announcement.id,
    }));

  for (let offset = 0; offset < notifications.length; offset += PAGE_SIZE) {
    const { error } = await supabase
      .from("notifications")
      .upsert(notifications.slice(offset, offset + PAGE_SIZE), {
        onConflict: "user_id,alerte_id,annonce_id",
        ignoreDuplicates: true,
      });

    if (error) {
      console.error("Could not insert matched notifications", error);
      return Response.json({ error: "Could not save matched notifications" }, { status: 500 });
    }
  }

  return Response.json({ status: "processed", matchedAlerts: notifications.length });
});
