# RAYONS Studio website

Open this folder in Visual Studio using **File → Open → Folder**, or in Visual Studio Code. This is a static HTML/CSS/JavaScript website with no build step, package installation, or framework required. Open `index.html` in a browser to preview it. For hosting, upload the entire folder to a static web host.

## Pages

- `index.html`: portfolio, studio introduction, contact section.
- `virtual-tours.html`: separate tour gallery.
- `tours/sample.html`: public, view-only illustrative 360 sample. The original sample and viewer URLs redirect here.
- `tour-admin.html`: GitHub-authenticated tour editing, publishing, client links and QR codes. See `ADMIN-SETUP.md`.

## Add your graphics

### Project albums

Visitors browse published albums and images on albums.html. The separate admin.html page authenticates through GitHub and publishes album content to your GitHub Pages repository. See [ADMIN-SETUP.md](ADMIN-SETUP.md) for setup, access tokens, publishing, and migration of previous browser-only uploads. No repository is connected yet.

The site intentionally uses graphic placeholders and a CSS architectural illustration, not sample projects presented as finished work. Replace project names and studio text to suit your practice.

1. Put your original logo in `assets/logo.png`. Replace each `.brand` link's contents with `<img src="assets/logo.png" alt="RAYONS Studio" style="max-width:150px;max-height:65px;object-fit:contain">`. The current geometric mark is a temporary CSS interpretation, not your original logo. The provided image could not be copied from the R: drive.
2. Place project images in `assets/`. In each `.project-image`, replace the placeholder spans with `<img src="assets/project-01.jpg" alt="Describe this interior" style="width:100%;height:100%;object-fit:cover">`, and remove its decorative frame by adding `.project-image:has(img)::before{display:none}` to the CSS.
3. For the hero, replace the contents of `.hero-art` with an image using the same image style. For the tour cover, replace the contents of `.tour-cover` with your cover image.
4. Replace `.contact-placeholder` with `<a href="mailto:YOUR_EMAIL">YOUR_EMAIL</a>` using your real email. No invented email or nonfunctional contact form is included.
5. Use `tour-admin.html` to create client tours or edit the public sample. Client tours stay unlisted; share the generated link or QR code.

Colours are controlled by variables at the top of `styles.css`: charcoal `#1d1e1d`, soft white `#f7f8f5`, muted teal `#a2c4be`. Navigation collapses on mobile; project filters work without dependencies. The tour loads only after visitors leave the main page.



## Virtual tour launch

Open [tour-admin.html](tour-admin.html) to create or edit tours. See [TOUR-LAUNCH.md](TOUR-LAUNCH.md) for the upload, draft, publish, verify and share workflow. Published client viewers and editable project files are created automatically under tours/.
