# Supabase tour integration — pending viewer deployment

Project: `zxhajwejsicweucptity`. Studio admin: `randall@rayonstudio.net`.

Completed on 12 October 2026:

- Created `rayon_tours`, admin-only RLS, and the private `rayon-tours` storage bucket.
- Copied the existing sample and Test client tour into private storage, with matching database records.
- Verified admin create/read/update/delete and denial of another user's read/write access in a rolled-back transaction. Supabase security advisors returned no findings.
- Implemented email/password admin, direct gallery selection, cloud publish/delete/offline actions, optimistic publication conflicts, and a server-gated viewer.
- Passed five Edge Function tests and a mocked browser lifecycle test covering the gallery, publishing, offline, deletion, and viewer expiry.

## Deployment blocker

The Supabase connector repeatedly returns `Function deploy failed due to an internal error`, including with a JS entrypoint and an explicit Deno configuration. No function was created. The GitHub production configuration has been pushed, but no Supabase deployment check appeared.

Deploy `supabase/functions/tour-view/index.ts` as **tour-view** in the project's Edge Functions dashboard, or enable **Deploy to production** for the existing GitHub integration (repository `Randznr/RayonStudio`, branch `main`, working directory `.`). JWT verification is disabled for this read-only function because client links are UUID bearer capabilities; the function checks the corresponding tour's publication and expiry before serving data. It exposes no catalog or write operations. Service credentials stay in the function's Supabase environment.

Dashboard: https://supabase.com/dashboard/project/zxhajwejsicweucptity/functions

## Activation after deployment succeeds

1. Verify the sample and existing client endpoint return the expected panoramas. Check absent, expired and offline IDs return no data, and verify private Storage remains inaccessible to anonymous requests.
2. Copy `backend/pending/tour-admin.html` and `tour-admin.js` to the website root, replacing the GitHub admin files. The new supporting cloud scripts are already included.
3. Replace `tours/sample.html` and existing `tours/client-UUID.html` with the `tours/view.html` shell. The shell resolves legacy filenames, preserving existing links. New links use `tours/view.html?id=UUID`.
4. Remove client source JSON and client catalog metadata from the published tree after verifying the private copies and retaining a local backup. Legacy Git history/downloaded copies remain public; backend expiry cannot revoke those copies. Do not advertise old tours as retroactively private.
5. Set Supabase Authentication URL configuration to `https://randznr.github.io/RayonStudio/tour-admin.html`. On the new admin page, use **Create admin account** with the studio email and a chosen password, confirm the email, then sign in. No password or service key should be pasted into chat. Authentication email delivery and real user sign-in still need verification; there is no admin Auth user yet.
6. Publish and test a temporary tour, check expiry/delete, then publish the frontend change to GitHub Pages and synchronize the local and `github-upload` copies.

Current root admin and public tours deliberately remain the working GitHub version until the function is live. Cloud admin files are staged under `backend/pending`. Do not rerun `schema.sql` on the existing project; it records the final base schema already applied through Supabase migrations. Temporary import and diagnostic policies have been removed.

Tests:

```
node --test tests/tour-cloud-edge.test.cjs
node tests/tour-cloud-browser.cjs
```

The browser test requires `RAYON_PLAYWRIGHT` pointing to the Playwright package and Microsoft Edge installed. It tests staged admin files automatically. The production schema intentionally grants no anonymous table or Storage access; client viewing goes through the Edge Function. Availability is checked before every new view and every 15 seconds while open. Previously loaded/downloaded images cannot be recalled.
