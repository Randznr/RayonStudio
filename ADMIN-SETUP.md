# Album and virtual tour publishing on GitHub Pages

Visitors use `albums.html`. You use `admin.html` to create albums, add images, rename albums, remove images, and publish. There is no admin link in the visitor navigation.

## First-time setup

1. Create your GitHub repository and upload this website, including `admin.html`, `admin.js`, `admin.css`, and `albums-data.js`, at its root.
2. In repository **Settings → Pages**, select **Deploy from a branch**, then your publishing branch (usually `main`) and **/(root)**. Save and wait for the website URL.
3. Create a fine-grained personal access token in GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens**. Select only this website repository and grant **Contents: Read and write**. Give the token an expiry date.
4. Open `admin.html` on your site. Enter `owner/repository`, the publishing branch, and the token. Treat the token as your admin password; enter it only in this form, never in website files or chat.

GitHub Pages cannot run a password authentication server. This implementation authenticates writes through GitHub's API using your token. The admin page itself is publicly accessible, but repository contents and edits require GitHub authorization. A normal username/password or GitHub OAuth login would require an additional authentication service.

## Your routine

Sign in, create or choose an album, and select **Add images**. Choose **Publish changes** when ready. One commit publishes the album list and new image files together. GitHub Pages then redeploys; visitors may need to refresh after a few minutes. Albums without images are hidden from the public category listings.

Changes are drafts in the current tab until published. The token is held only in memory and cleared on sign-out or page reload. Unpublished drafts are not saved when the tab closes. Upload JPEG, PNG, WebP, GIF or AVIF files up to 10 MB each; use web-sized images for quicker loading.

Removed images disappear from the published gallery but their files and prior commits remain in the repository. The publisher does not force-push or overwrite newer branch changes. If the repository changes during your session, reload the latest albums before making further edits. Protected branches must permit your account to commit, or a separate pull-request publishing workflow will be needed.

## Existing browser uploads

The previous version kept albums in IndexedDB, on one browser and one site address. Those records are preserved. The admin's **Import previous browser albums** reads them into drafts without deleting them. Import must run at the same origin as the old uploads; your new GitHub Pages address cannot read storage from a local preview. To migrate those albums, open the new admin through the original local preview address and sign in to your GitHub repository there, or upload the original images again on the live admin page.

## Validation and hosting

No GitHub credentials are included in these files. The repository is not yet connected or deployed. Use a public repository for a standard GitHub Pages setup; the admin image previews use GitHub's public raw image URLs. Keep the website files at the publishing branch root.

References: [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [fine-grained token permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens).

## Virtual tours

Open `tour-admin.html` (also linked from album admin) and sign in using the same repository, branch and token. Upload the entire website first, including `assets/vendor`, `tour-editor.html`, the tour scripts, and `tours/catalog.json`.

- **Public sample:** select “Public sample” and replace the illustrative panoramas with your own. Both public tour landing pages and the older sample URLs open `tours/sample.html`.
- **Client tours:** choose **New client tour**, enter a title, then add panoramic room images. Use 2:1 equirectangular JPEG, PNG or WebP images. The editor supports room replacement, renaming (double-click a room), removal, hotspots, floor plans, branding, alternate styles and start views.
- **Import/edit:** import a RAYON exported HTML tour or the JSON backup. Only tour data is read; scripts in imported HTML are never executed. Other vendors' HTML exports and ZIP packages are not supported.
- **Preview/publish:** Client preview opens the actual view-only viewer. Publish tour commits that viewer and its catalog entry together. No editing interface or credentials are included in the exported viewer. Wait for GitHub Pages to deploy before sharing.
- **Share:** confirm your actual live website address, then copy the direct link or download its QR code as SVG. QR generation happens locally. Updating a tour preserves its ID, viewing link and QR code. A new tour receives a separate random ID. Client tours are never listed on public landing pages.
- **Backup:** Download editable backup before closing the tab or reloading. Drafts are in memory. A changed repository branch blocks publishing; download the backup, sign in again, select the correct tour, and import the backup to retry against the latest revision. Tours must be under 40 MB for publishing.

Client tours are **unlisted, not confidential or authenticated**. Anyone with a link can view them, and files/catalog entries can be discovered in a public GitHub repository. The noindex directive asks search engines not to index viewers; it is not access control. True client passwords or expiring access require another hosting/authentication service. GitHub enforces your permission to publish, even though the static admin files themselves are accessible.

The supplied sample editor contained no panorama content. The included sample is a clearly labelled illustrative two-room demonstration generated by `tools/create-sample.py` and `tools/build-sample.cjs`; it is not client photography. `tools/prepare-tours.cjs` records the one-time migration and should not be rerun against the now-redirected original sample file. Local Three.js r128 and QR generator 1.4.4 libraries are in `assets/vendor` with their licenses.
