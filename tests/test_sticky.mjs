// TU sticky headers: scroll right on a long board, labels must stay visible.
// Requires playwright (optional dependency) AND the demo server running on
// :4200 (node tests/demo-server.mjs). Skips cleanly when playwright is
// missing — no hard browser dependency in the default test run.
let chromium = null
for (const spec of [
  '/usr/local/lib/node_modules/playwright/index.mjs',
  '/usr/local/lib/node_modules/playwright/index.js',
  'playwright'
]) {
  try {
    ;({ chromium } = await import(spec))
    break
  } catch { /* try next */ }
}
if (!chromium) {
  console.warn('SKIP: playwright not installed — sticky-header UI test skipped')
  process.exit(0)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', e => errors.push(String(e)))

await page.goto('http://127.0.0.1:4200/demo.html', { waitUntil: 'domcontentloaded' })
await page.waitForFunction('window.__KG_READY === true', null, { timeout: 20_000 })

// zoom in to make the timeline much wider than the viewport
await page.locator('#zoom2').focus()
for (let i = 0; i < 7; i++) { await page.keyboard.press('ArrowRight') }
await page.waitForTimeout(300)

const scroller = page.locator('#scroller')
// scroll far right
await page.evaluate(() => { document.getElementById('scroller').scrollLeft = 2000 })
await page.waitForTimeout(300)

// the first row's label must still be visible (x near 0 in viewport coords)
const box = await page.locator('.kg-row').first().locator('.label button').boundingBox()
console.log('label bounding box after scroll:', JSON.stringify(box))
if (!box || box.x < 0 || box.x > 320) {
  console.error('STICKY FAIL — label scrolled out of view')
  process.exit(1)
}
await page.screenshot({ path: '/opt/shared/screenshots/demo-sticky.png' })
await browser.close()
if (errors.length) { console.error('PAGE ERRORS:', errors); process.exit(1) }
console.log('OK — sticky labels stay visible after horizontal scroll')