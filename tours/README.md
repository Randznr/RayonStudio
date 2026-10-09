# Tour publishing files

- `sample.html`: the public sample viewer.
- `client-<id>.html`: a stable, unlisted client viewer created by tour admin.
- `data/<id>.json`: editable project data created when publishing. Admin loads this when reopening a project.
- `catalog.json`: admin's tour list, publication state and revision metadata.
- `RayonS360_final.html`: compatibility link to the sample.

Use `/tour-admin.html` to manage these files. Publish writes the viewer, editable data and catalog in one GitHub commit. Republish preserves the viewing URL and QR code. Take offline replaces the viewer with an unavailable page and retains editable data for later republication.

All files on GitHub Pages, including source data, are public. These folders are organization, not access control. Do not upload confidential material that requires client authentication. No tokens or passwords belong in this directory.
