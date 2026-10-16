# Supabase tours — deployed 16 October 2026

The tour-view Edge Function is ACTIVE (version 1). Deployment through the Supabase connector succeeded on 16 October; the previous internal error did not recur.

The site now uses the Supabase studio sign-in and private tour storage. Existing sample and client URLs use the cloud viewer shell. The client source JSON and client catalog entry have been removed from the current published tree; a local backup is retained under backend/local-backup-2026-10-16 (not committed). Historic Git commits and earlier downloads are not revoked.

Verified: both existing tours return HTTP 200 and two rooms; unknown IDs return 404; anonymous catalog and private Storage access are denied. Five function tests and the mocked browser lifecycle test passed. Supabase security advisors returned no findings.

## First studio sign-in

Open https://randznr.github.io/RayonStudio/tour-admin.html, enter the studio email and a chosen password, select Create admin account, confirm the email, and then sign in. No confirmed studio account existed at deployment. Real email delivery and user sign-in require the owner's completion and have not been verified.

The connected tools do not expose Auth URL settings and no connected dashboard browser was available. The owner should set the Site URL to https://randznr.github.io/RayonStudio/tour-admin.html in Supabase Authentication > URL Configuration. If the confirmation link redirects to localhost, confirmation can still succeed: return to the admin page and sign in.

Website hosting remains GitHub Pages. The function is deployed directly in Supabase; automatic GitHub-to-Supabase deployment has not been enabled or verified. Future function changes need deployment through the connector/CLI or a configured production integration.
Live browser verification passed after GitHub Pages deployment: studio email sign-in form, both original tour URLs rendering two panoramas through Supabase, and unavailable-link handling. Run tests/tour-cloud-live-browser.cjs with RAYON_PLAYWRIGHT set to the installed Playwright package.
