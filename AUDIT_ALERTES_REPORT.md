# Chantier 2 — Système d’alertes

**État :** préparation locale uniquement — aucune migration poussée et aucun webhook branché.  
**Date :** 7 octobre 2026.

## Constat

- L’interface enregistre les critères dans `public.alertes_recherche`, mais le code applicatif présent n’évalue pas ces critères à l’arrivée d’une annonce.
- La base décrit déjà `push_subscriptions` dans le snapshot TypeScript, et le navigateur sait demander une permission push et enregistrer une souscription. En revanche, aucun expéditeur serveur n’est présent dans le code local : l’enregistrement d’une souscription ne déclenche donc pas à lui seul une notification.
- Les critères d’alerte utilisent un `departement` structuré, tandis que les annonces existantes stockent une `localisation` libre dans `public.publications`. Le snapshot local ne contient pas encore de colonne `publications.departement`.
- L’interface annonçait une notification dès qu’une annonce correspondait, promesse non mise en œuvre. Elle indique maintenant que l’alerte est enregistrée et que les notifications automatiques arrivent bientôt.
- Le dépôt ne contient pas de migrations antérieures permettant de confirmer le schéma réel distant. Les migrations ci-dessous sont donc préparées contre les tables et colonnes utilisées par le code local, sans exécution.

## Changements préparés

1. Migration `push_subscriptions` : endpoint unique, relation utilisateur, index et accès RLS propriétaire.
2. Migration `notifications` : références vers l’utilisateur, l’alerte et `publications`, unicité pour éviter les doublons, index de lecture par utilisateur et RLS. Le client peut lire et marquer comme lu ses notifications ; seule la fonction serveur est autorisée à créer les lignes.
3. Migration des annonces : ajout de `publications.departement`, classification initiale des localisations qui contiennent le nom explicite d’un des douze départements béninois et index partiel. Les localisations ne contenant pas un nom de département restent `NULL` plutôt que d’être classées par supposition.
4. Edge Function `match-alerts` : endpoint POST destiné à recevoir un webhook `INSERT` de `public.publications`, authentification par secret dédié, recherche paginée des alertes actives, correspondance insensible à la casse de `mot_cle` dans titre/description, égalité de catégorie et correspondance du département dans la colonne normalisée ou la localisation libre, puis upsert idempotent dans `notifications`.

## Limites à traiter avant branchement

- Les annonces non approuvées ou rejetées sont ignorées pour ne pas notifier à partir de contenus non publiés. Or le flux d’inscription actuel crée vraisemblablement une annonce avant modération ; un webhook strictement `INSERT` ne notifiera donc pas son approbation ultérieure. Le branchement devra aussi réagir au passage à `approuve = true` (ou être appelé à l’approbation), sans envoyer de notification avant publication.
- Le backfill remplit le département seulement quand `localisation` contient déjà explicitement son nom. Il ne convertit pas automatiquement les noms de communes/villages en départements ; il faudra collecter une valeur de département structurée à la publication ou fournir une table de correspondance fiable.
- Avant d’appliquer les migrations, confirmer sur la base cible les types réels de clés (`alertes_recherche.id`, `publications.id`), les contraintes et les éventuelles lignes existantes, notamment les endpoints push en doublon.
- Le snapshot de types actuel indique que plusieurs champs de `push_subscriptions` peuvent être `NULL`. La migration les rend obligatoires ; vérifier et traiter explicitement les anciennes lignes incomplètes avant toute application.
- Configurer `MATCH_ALERTS_WEBHOOK_SECRET` côté Edge Function et utiliser le même bearer secret côté webhook. `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` doivent rester des secrets serveur ; la clé de service n’est pas utilisée dans le navigateur.
- Aucun push web n’est envoyé dans cette première version : la fonction crée uniquement des lignes de notification en base. L’envoi aux endpoints Web Push, les clés privées VAPID et le cycle de suppression des endpoints expirés constituent une étape serveur distincte.

## Vérifications / opérations volontairement non effectuées

Aucune commande `supabase login`, `supabase link`, `supabase db push`, `supabase functions deploy` ou `git push` n’a été exécutée. Les migrations et la fonction sont uniquement des fichiers locaux en attente de validation contre le schéma Supabase réel.
