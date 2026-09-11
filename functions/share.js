const SUPABASE_URL = "https://eablggolxlmnquryqztp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mz6zfBMh-JYYJpe5cVZ46g_bdmF-SWd";
const SITE_URL = "https://richfarmunity.com";
const DEFAULT_IMAGE = SITE_URL + "/icon-512.png";

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id") || "";
  const destination = id ? `${SITE_URL}/?view=publications&id=${id}` : `${SITE_URL}/?view=publications`;

  let titre = "Rĩch Farm Unity";
  let description = "Découvre cette annonce sur Rĩch Farm Unity, la plateforme agricole béninoise.";
  let image = DEFAULT_IMAGE;

  if (id) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/publications?id=eq.${encodeURIComponent(id)}&select=titre,description,prix,localisation,photos,photo_url&approuve=is.true`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      if (res.ok) {
        const rows = await res.json();
        const p = rows && rows[0];
        if (p) {
          titre = p.titre || titre;
          const bits = [];
          if (p.prix) bits.push(`Prix : ${p.prix}`);
          if (p.localisation) bits.push(`Lieu : ${p.localisation}`);
          if (p.description) bits.push(p.description);
          if (bits.length) description = bits.join(" · ");
          const photo = (p.photos && p.photos.length > 0) ? p.photos[0] : p.photo_url;
          if (photo) image = photo;
        }
      }
    } catch (e) {
      // En cas d'erreur, on retombe sur les valeurs par défaut ci-dessus.
    }
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(titre)} — Rĩch Farm Unity</title>
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(titre)} — Rĩch Farm Unity">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(destination)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(titre)} — Rĩch Farm Unity">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(destination)}">
<script>window.location.replace(${JSON.stringify(destination)});</script>
</head>
<body>
<p>Redirection vers Rĩch Farm Unity… <a href="${escapeHtml(destination)}">Cliquez ici si rien ne se passe</a>.</p>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "public, max-age=300" }
  });
}

