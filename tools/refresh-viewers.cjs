// Rebuild existing public viewers using their embedded, validated tour data.
const fs = require('node:fs');
const path = require('node:path');
global.window = global;
require('../tour-data.js');
require('../tour-format.js');
const root = path.join(__dirname, '..');
for (const name of fs.readdirSync(path.join(root, 'tours'))) {
  if (!/^(sample|client-[\w-]+)\.html$/.test(name)) continue;
  const file = path.join(root, 'tours', name);
  const html = fs.readFileSync(file, 'utf8');
  // Leave offline notices untouched.
  if (!html.includes('id="data"')) continue;
  const data = TourData.parse(html);
  fs.writeFileSync(file, TourFormat.build(data));
  console.log('Updated viewer: ' + name);
}
