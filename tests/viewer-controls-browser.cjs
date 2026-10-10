const { chromium } = require(process.env.RAYON_PLAYWRIGHT || 'playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try {
    res.setHeader('Content-Type', { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'xr', { configurable: true, value: {
        isSessionSupported: async () => true,
        requestSession: async (mode) => {
          window.requestedVR = mode;
          if (window.denyVR) throw new Error('Denied');
          const session = new EventTarget();
          session.end = async () => session.dispatchEvent(new Event('end'));
          return session;
        }
      } });
      window.DeviceOrientationEvent.requestPermission = async () => window.denyMotion ? 'denied' : 'granted';
    });
    await page.route('**/tour-controls.js', async route => {
      const source = fs.readFileSync(path.join(root, 'tour-controls.js'), 'utf8');
      await route.fulfill({ contentType: 'application/javascript', body: source + `
        const originalControls = window.RayonTourControls;
        window.RayonTourControls = function(options) {
          window.testCamera = options.camera;
          options.renderer.xr.setSession = async function() {};
          return originalControls(options);
        };` });
    });
    const base = 'http://127.0.0.1:' + server.address().port;
    await page.goto(base + '/index.html');
    assert.equal(await page.locator('#whatsapp-chat').getAttribute('href'), 'https://wa.me/26774074086');
    assert.equal(await page.evaluate(() => !document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))), true);
    await page.goto(base + '/tours/sample.html');
    await page.waitForFunction(() => window.testCamera && document.querySelector('#tour-help').textContent.startsWith('Drag'));
    const q = () => page.evaluate(() => window.testCamera.quaternion.toArray());
    const initial = await q();
    await page.mouse.move(180, 420); await page.mouse.down(); await page.mouse.move(260, 460); await page.mouse.up();
    await page.waitForTimeout(100); assert.notDeepEqual(await q(), initial);
    const beforeTouch = await q();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 430 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90, y: 440 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(100); assert.notDeepEqual(await q(), beforeTouch);
    await page.evaluate(() => window.denyMotion = true);
    await page.getByRole('button', { name: 'Enable motion', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'declined' }).waitFor();
    await page.evaluate(() => window.denyMotion = false);
    await page.getByRole('button', { name: 'Enable motion', exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 90, gamma: 0 })));
    await page.waitForTimeout(100); const beforeMotion = await q();
    await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 45, beta: 70, gamma: 5 })));
    await page.waitForTimeout(100); assert.notDeepEqual(await q(), beforeMotion);
    await page.getByRole('button', { name: 'Disable motion', exact: true }).click();
    await page.waitForTimeout(100); const stopped = await q();
    await page.waitForTimeout(100); assert.deepEqual(await q(), stopped);
    await page.getByRole('button', { name: 'Enable motion', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'No motion data' }).waitFor({ timeout: 7000 });
    await page.evaluate(() => window.denyVR = true);
    await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'could not start' }).waitFor();
    await page.evaluate(() => window.denyVR = false);
    await page.getByRole('button', { name: 'Enter VR', exact: true }).click();
    await page.getByRole('button', { name: 'Exit VR', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.requestedVR), 'immersive-vr');
    assert.equal(await page.getByRole('button', { name: 'Enable motion', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Exit VR', exact: true }).click();
    await page.getByRole('button', { name: 'Enter VR', exact: true }).waitFor();
    await page.locator('.sw').nth(1).click(); assert.match(await page.locator('#lbl').innerText(), /study/);
    await page.screenshot({ path: path.join(root, 'tests/viewer-controls-mobile.png') });
    await page.setViewportSize({ width: 1365, height: 900 });
    await page.screenshot({ path: path.join(root, 'tests/viewer-controls-desktop.png') });
    assert.deepEqual(errors, []);
    const fallback = await browser.newPage();
    await fallback.addInitScript(() => Object.defineProperty(navigator, 'xr', { value: undefined }));
    await fallback.goto(base + '/tours/sample.html');
    assert.equal(await fallback.getByRole('button', { name: 'VR unavailable', exact: true }).isDisabled(), true);
    console.log('PASS: context menu, WhatsApp, mouse/touch, motion permission/movement/timeout, mocked VR lifecycle, fallback, room navigation; no browser errors.');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
