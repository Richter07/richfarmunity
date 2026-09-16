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
  const shareUrl = url.toString();
  const id = url.searchParams.get("id") || "";
  const typeParam = url.searchParams.get("type");
  const type = (typeParam === "formation" || typeParam === "publicite") ? typeParam : "publication";

  const view = type === "formation" ? "formations" : (type === "publicite" ? "formations" : "publications");
  const destination = id ? `${SITE_URL}/?view=${view}&id=${id}` : `${SITE_URL}/?view=${view}`;

  let titre = "Rĩch Farm Unity";
  let description = "Découvre Rĩch Farm Unity, la plateforme agricole béninoise.";
  if (type === "formation") description = "Découvre cette formation sur Rĩch Farm Unity, la plateforme agricole béninoise.";
  if (type === "publication") description = "Découvre cette annonce sur Rĩch Farm Unity, la plateforme agricole béninoise.";
  if (type === "publicite") description = "Une publicité partenaire sur Rĩch Farm Unity, la plateforme agricole béninoise.";
  let image = DEFAULT_IMAGE;

  if (id) {
    try {
      const table = type === "formation" ? "formations" : (type === "publicite" ? "publicites" : "publications");
      const selectFields = type === "formation"
        ? "titre,contenu,media_url,media_type"
        : type === "publicite"
        ? "annonceur,image_url,lien"
        : "titre,description,prix,localisation,photos,photo_url";
      const filtre = type === "publicite" ? "&actif=is.true" : (type === "formation" ? "" : "&approuve=is.true");

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=${selectFields}${filtre}`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      if (res.ok) {
        const rows = await res.json();
        const p = rows && rows[0];
        if (p) {
          if (type === "formation") {
            titre = p.titre || titre;
            if (p.contenu) description = p.contenu.slice(0, 200);
            if (p.media_url && p.media_type !== "video") image = p.media_url;
          } else if (type === "publicite") {
            titre = p.annonceur || titre;
            if (p.image_url) image = p.image_url;
          } else {
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
<meta property="og:url" content="${escapeHtml(shareUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(titre)} — Rĩch Farm Unity">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
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
