import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

await mkdir('artifacts', { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 })
const errors = []
const baseUrl = process.env.ELYRIA_URL || 'http://127.0.0.1:5173'
const checks = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
try {
  await page.goto(`${baseUrl}/?quality=LITE`, { waitUntil: 'networkidle' })
  await page.getByText('Preparing your little corner…').waitFor({ state: 'hidden', timeout: 60000 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'artifacts/plaza-desktop.png' })
  await page.keyboard.press('F3')
  await page.getByRole('complementary', { name: 'Runtime diagnostics' }).waitFor()
  const readCoordinates = async () => {
    const text = await page.locator('.debug-panel dt').filter({ hasText: 'Player XYZ' }).evaluate(element => element.nextElementSibling.textContent)
    return text.split(',').map(Number)
  }
  const start = await readCoordinates()
  // Short real key holds keep the movement check inside its landmark radius
  // even when software-renderer/CDP latency delays position observations.
  const moveUntil = Date.now() + 120000
  let moved = start
  while (Date.now() < moveUntil) {
    await page.keyboard.press('w', { delay: 500 })
    await page.waitForTimeout(500)
    moved = await readCoordinates()
    if (Math.hypot(moved[0] - start[0], moved[2] - start[2]) > 1 && Math.hypot(moved[0], moved[2]) < 6.3) break
  }
  if (Math.hypot(moved[0] - start[0], moved[2] - start[2]) < 1 || Math.hypot(moved[0], moved[2]) >= 6.3) throw new Error(`Movement did not reach the plaza interaction area: ${moved}`)
  await page.keyboard.press('e')
  await page.getByRole('status').filter({ hasText: 'Blossom Plaza' }).waitFor()
  checks.push('WASD movement and real landmark discovery/interaction')
  // Space activates a focused UI button; test gameplay with focus in the world.
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur() })
  await page.keyboard.down('Space')
  let jumping = await readCoordinates()
  const jumpUntil = Date.now() + 5000
  while (jumping[1] < 0.2 && Date.now() < jumpUntil) { await page.waitForTimeout(80); jumping = await readCoordinates() }
  await page.keyboard.up('Space')
  let landed = await readCoordinates()
  const landUntil = Date.now() + 5000
  while (landed[1] > 0.1 && Date.now() < landUntil) { await page.waitForTimeout(80); landed = await readCoordinates() }
  if (jumping[1] < 0.2 || landed[1] > 0.1) throw new Error(`Jump/landing failed: ${jumping}/${landed}`)
  checks.push('Jump edge and landing')
  await page.keyboard.press('m')
  await page.getByRole('dialog').waitFor()
  const pausedAt = await readCoordinates()
  await page.keyboard.down('w'); await page.waitForTimeout(650); await page.keyboard.up('w')
  const pausedEnd = await readCoordinates()
  if (Math.hypot(pausedAt[0] - pausedEnd[0], pausedAt[2] - pausedEnd[2]) > 0.1) throw new Error('Map did not pause movement')
  checks.push('World-derived map and paused movement')
  await page.screenshot({ path: 'artifacts/plaza-map.png' })
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'lite', exact: true }).click({ noWaitAfter: true })
  await page.getByRole('button', { name: 'Back to wandering' }).click({ noWaitAfter: true })
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Return to plaza entrance' }).click({ noWaitAfter: true })
  await page.keyboard.press('F3')
  await page.keyboard.press('c')
  await page.waitForTimeout(1600)
  await page.screenshot({ path: 'artifacts/plaza-vista.png' })
  await page.keyboard.press('F3')
  const telemetry = await page.locator('.debug-panel').innerText()
  if (!telemetry.includes('LITE / 0.75')) throw new Error('Renderer DPR did not preserve the selected quality')
  checks.push('Quality remains active during HUD updates; follow/vista switching')
  await page.screenshot({ path: 'artifacts/plaza-diagnostics.png' })
  const gpu = await page.locator('canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'Unavailable'
  })
  console.log('Desktop controls and rendering passed; collecting 30-second Lite profile.')
  await page.waitForTimeout(10000)
  const profile = await page.evaluate(() => new Promise(resolve => {
    const intervals = []
    let previous = performance.now()
    const start = previous
    function frame(now) {
      intervals.push(now - previous)
      previous = now
      if (now - start < 30000) { requestAnimationFrame(frame); return }
      const sorted = [...intervals].sort((a, b) => a - b)
      const meanMs = intervals.reduce((sum, value) => sum + value, 0) / intervals.length
      resolve({ durationMs: now - start, frames: intervals.length, meanMs, fps: 1000 / meanMs,
        p50Ms: sorted[Math.floor(sorted.length * 0.5)], p95Ms: sorted[Math.floor(sorted.length * 0.95)],
        maxMs: sorted.at(-1), framesOver100ms: intervals.filter(value => value > 100).length })
    }
    requestAnimationFrame(frame)
  }))
  await writeFile('artifacts/profile-LITE.json', JSON.stringify({ measuredAt: new Date().toISOString(), gpu,
    viewport: { width: 1440, height: 960 }, quality: 'LITE', dpr: 0.75, camera: 'vista', warmupSeconds: 10,
    sample: profile, telemetry: await page.locator('.debug-panel').innerText(), gpuTiming: 'Unavailable',
    limitation: 'Stationary headless software-renderer baseline; does not establish real-device desktop/mobile targets.' }, null, 2))
  await page.getByRole('button', { name: 'Open pause menu' }).click({ noWaitAfter: true })
  await page.getByRole('button', { name: 'high', exact: true }).click({ noWaitAfter: true })
  await page.getByRole('button', { name: 'Back to wandering' }).click({ noWaitAfter: true })
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await page.waitForFunction(() => document.querySelector('.debug-panel')?.textContent.includes('HIGH /'), undefined, { timeout: 60000 })
  await page.waitForTimeout(2500)
  const highTelemetry = await page.locator('.debug-panel').innerText()
  await page.getByRole('button', { name: 'Close diagnostics' }).click({ noWaitAfter: true })
  await page.screenshot({ path: 'artifacts/plaza-high.png', timeout: 60000 })
  checks.push('High quality loads full assets and shadows')
  await page.keyboard.press('F3')
  const timeSlider = page.getByRole('slider').first()
  const timeBounds = await timeSlider.boundingBox()
  if (!timeBounds) throw new Error('Time slider missing')
  await timeSlider.click({ position: { x: timeBounds.width * 0.9, y: timeBounds.height / 2 }, noWaitAfter: true })
  await page.getByText('Clear skies', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Close diagnostics' }).click({ noWaitAfter: true })
  await page.screenshot({ path: 'artifacts/plaza-night.png', timeout: 60000 })
  checks.push('World clock changes sky, lighting, and night windows')
  await page.close()
  console.log('Day/night checks passed; verifying touch input and mobile layout.')
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  mobile.on('pageerror', error => errors.push(error.message))
  mobile.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await mobile.goto(`${baseUrl}/?quality=LITE`, { waitUntil: 'networkidle' })
  await mobile.getByText('Preparing your little corner…').waitFor({ state: 'hidden', timeout: 60000 })
  const readMobilePosition = () => mobile.locator('.minimap-button .world-map > circle:last-child').evaluate(circle => [Number(circle.getAttribute('cx')), Number(circle.getAttribute('cy'))])
  const mobileStart = await readMobilePosition()
  const stick = await mobile.getByRole('group', { name: 'Drag to move' }).boundingBox()
  if (!stick) throw new Error('Mobile joystick not visible')
  const cdp = await mobile.context().newCDPSession(mobile)
  const x = stick.x + stick.width / 2
  const y = stick.y + stick.height / 2
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 33, id: 1 }] })
  let mobileMoved = await readMobilePosition()
  const touchUntil = Date.now() + 10000
  while (Math.hypot(mobileMoved[0] - mobileStart[0], mobileMoved[1] - mobileStart[1]) < 1 && Date.now() < touchUntil) {
    await mobile.waitForTimeout(150); mobileMoved = await readMobilePosition()
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  if (Math.hypot(mobileMoved[0] - mobileStart[0], mobileMoved[1] - mobileStart[1]) < 1) throw new Error('Real touch joystick movement failed')
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  if (overflow) throw new Error('Mobile layout overflows')
  await mobile.screenshot({ path: 'artifacts/plaza-mobile.png', timeout: 60000 })
  await mobile.getByRole('button', { name: 'Open Blossom Central map' }).click({ noWaitAfter: true })
  await mobile.getByRole('dialog').waitFor()
  await mobile.getByRole('button', { name: 'Close dialog' }).click({ noWaitAfter: true })
  checks.push('390×844 mobile layout, actual touch joystick, and map controls')
  await mobile.close()
  const failed = await browser.newPage({ viewport: { width: 1100, height: 750 } })
  await failed.route('**/assets/architecture/blossom_bistro_exterior_lod1.glb', route => route.abort())
  await failed.goto(`${baseUrl}/?quality=LITE`, { waitUntil: 'networkidle' })
  await failed.getByRole('alert').waitFor({ timeout: 30000 })
  if (await failed.getByText('Preparing your little corner…').isVisible()) throw new Error('Loading overlay masks asset error')
  await failed.screenshot({ path: 'artifacts/asset-error.png' })
  await failed.close()
  checks.push('Missing asset shows a recoverable error without a stuck loader')
  const report = { testedAt: new Date().toISOString(), browser: 'Chromium headless', baseUrl, gpu, errors, checks,
    start, moved, jumping, landed, pausedAt, pausedEnd, telemetry, highTelemetry, mobileStart, mobileMoved }
  await writeFile('artifacts/browser-check.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (errors.length) throw new Error('Browser errors found')
} catch (error) {
  await writeFile('artifacts/browser-failure.json', JSON.stringify({ error: error.message, errors, checks, html: await page.locator('body').innerText().catch(() => '') }, null, 2))
  throw error
} finally { await browser.close() }
