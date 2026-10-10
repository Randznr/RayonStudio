# Virtual tour publishing — Rayon Studio

**Admin:** https://randznr.github.io/RayonStudio/tour-admin.html  
**Public landing page:** https://randznr.github.io/RayonStudio/virtual-tours-landing.html  
**Public sample:** https://randznr.github.io/RayonStudio/tours/sample.html

## Sign in

The repository and branch are prefilled: `Randznr/RayonStudio`, `main`. Create a fine-grained GitHub personal access token for **this repository only**, with **Contents: Read and write**, and enter it in the admin form. GitHub authorizes publishing; your token stays in memory and is cleared on sign-out/reload. Do not put it in website files, a project backup or chat. Renew the token in GitHub when it expires.

## Publish a client tour

1. Select **New client tour** and enter the project title.
2. Select **Add room photo**. You can select multiple JPEG, PNG or WebP panoramas at once. Each can be up to 20 MB. All image proportions are accepted, including 16:9. A 2:1 equirectangular panorama (width x height, for example 4000 x 2000) is recommended for a full sphere; other proportions may look stretched. Ordinary interior photos do not become 360 panoramas simply by uploading them.
3. Double-click a room thumbnail to rename it. Use **Replace room image**, **Edit hotspots**, **Floor plan & map**, **Branding**, **Alt style** and **Set start view** as needed. Link hotspots connect rooms; note hotspots explain details.
4. Select **Client preview** to check exactly what visitors will see. They have no upload or editing controls.
5. Select **Save browser draft** to save work on this browser/device, or **Download editable backup** for a portable JSON copy. Neither publishes the tour.
6. Select **Publish tour**. The viewer, editable source and catalog are committed together. The entire exported viewer must remain under 40 MB, with at most 100 rooms.
7. Wait for GitHub Pages to deploy, then select **Check live link**. A **Ready to share** message confirms the specific published revision is served, not just an older page at the same URL. If it still says an older version is live, wait and check again.
8. Use **Copy link** or **Download QR code**. Send these yourself through your preferred channel. The site does not email clients automatically. Confirm the website address remains `https://randznr.github.io/RayonStudio/` unless you configure a custom domain.

## Edit, resume or take offline

- **Edit an existing tour:** choose it from the tour list. Admin retrieves its saved editable source. Republish keeps the same viewing URL and QR code.
- **Restore work:** expand **Restore a saved browser draft** after sign-in and choose a saved project. Browser drafts survive reload/sign-out but can be removed by clearing browser storage. Draft saves are manual, not automatic. Download backups for long-term retention.
- **Import:** use a RAYON exported HTML tour or JSON backup. Imported HTML scripts are never executed. Other vendors' HTML/ZIP packages are not supported.
- **Take tour offline:** replaces the client viewing page with an unavailable notice after the next deployment; the editable source remains. Choose the offline project and publish again to reopen the same link. This is not a secure deletion: repository history, source data, browser caches and any downloaded copies may remain accessible.
- **Repository changed:** download a backup or save a browser draft, sign out/in to load the new repository version, then restore/import your project. The publisher refuses to overwrite a newer GitHub commit.

## Folder layout

```text
tour-admin.html            Admin entry point
tour-editor.html           Room/hotspot editing workspace
tour-admin.js              GitHub publishing, sharing and live checks
tour-drafts.js             Browser draft storage (no credentials)
tour-data.js               Data validation and file paths
tour-format.js             Read-only viewer generation
assets/vendor/            Local Three.js and QR library + licenses
Images/                   Light/dark studio logos
tours/catalog.json        Tour names, status, revision and source metadata
tours/sample.html         Public sample viewer
tours/client-<id>.html     Stable client viewing link
tours/data/<id>.json       Editable source for a published project
```

Publishing creates project files automatically. You do not need to create a folder or write a URL for each client. Older tours without a separate JSON source are loaded from their exported viewer and migrated on their next publication. The public sample is edited separately from client projects and is the only tour linked on the public landing page.

## Access model

This is a GitHub Pages site: GitHub's API is the authenticated publishing/storage service, not a separate private application server. The public/admin page files can be downloaded by visitors, but publishing requires repository write credentials. Client tours are **unlisted**, with random IDs and a noindex directive. Anyone with a link can view them, and a public repository exposes source files and the catalog. Password-protected client access, expiring links or private storage require a separate backend/hosting service.

## Checks before sending a real client link

### Looking around and VR

Visitors can drag with a mouse, swipe on a touchscreen, or select **Enable motion** and grant sensor permission to look around by moving their phone. Dragging switches back to manual control. Motion controls require HTTPS and a device/browser that supplies orientation data. Permission denial or missing sensors leaves manual controls available.

**Enter VR** starts an immersive WebXR session on a supported headset/browser over HTTPS. Each eye is rendered through Three.js WebXR with headset tracking. A controller trigger advances to the next room; exit with the headset's system menu or **Exit VR**. The button shows **VR unavailable** when the browser cannot offer an immersive session. Ordinary photos remain panoramas rather than reconstructed 3D spaces. Physical headset and phone checks are required before promising compatibility with a particular device.

The controls are available in client preview, the public sample, and generated client tours. After changing the viewer generator, run `node tools/refresh-viewers.cjs` to upgrade existing active viewers while retaining their tour data. Offline notices are left intact.

The shared `site-features.js` adds the WhatsApp link for +267 74074086 and suppresses the context menu and image dragging. This discourages casual copying; it does not prevent downloading content, taking screenshots, or inspecting source.

Preview each room, hotspot and alternate style, publish, run **Check live link**, and open the viewing URL on a phone or a signed-out browser. Scan the QR with a phone camera. Back up the editable project. The sample is an illustrative demo; replace it with approved portfolio panoramas when ready.
