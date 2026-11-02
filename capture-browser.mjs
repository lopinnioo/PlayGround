import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFileSync, mkdirSync } from 'node:fs'

const runtime = join(process.env.HOME, '.local/share/omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))
const { chromium } = require('playwright')
const captures = require(join(process.env.RUNTIME_DIR, 'scripts/wip-screenshots.cjs'))
captures.instrument({ chromium })
const config = JSON.parse(readFileSync(join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json'), 'utf8'))
if (process.platform === 'linux') process.env.DISPLAY ||= ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()
const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR
if (!url || !output) throw new Error('Set CAPTURE_URL and CAPTURE_DIR.')
mkdirSync(output, { recursive: true })
const { startForCapture } = await import(pathToFileURL(join(process.env.RUNTIME_DIR, 'scripts/capture-start.mjs')))
const transient = error => { throw Object.assign(error, { exitCode: 75 }) }
let browser
try {
  browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }).catch(transient)
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } }).catch(transient)
    page.setDefaultTimeout(30000)
    const failures = []
    page.on('pageerror', error => { console.error(error.message); failures.push(error.message) })
    page.on('response', response => {
      if (response.status() >= 400 && new URL(response.url()).origin === new URL(url).origin) {
        failures.push(`HTTP ${response.status()}: ${response.url()}`)
      }
    })
    const response = await page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(transient)
    if (!response?.ok()) {
      const status = response?.status()
      throw Object.assign(new Error(`HTTP ${status ?? 'unknown'} loading preview`), {
        exitCode: !response || [408, 429, 500, 502, 503, 504].includes(status) ? 75 : 1
      })
    }
    await page.locator(process.env.CAPTURE_READY_SELECTOR || '#title-screen').waitFor({ state: 'visible' })
    await page.waitForFunction(() => document.fonts.status === 'loaded')
    await page.locator('#loading').waitFor({ state: 'hidden', timeout: 45000 })
    const start = await startForCapture(page, {
      enabled: process.env.CAPTURE_AUTO_START !== 'false',
      selector: process.env.CAPTURE_START_SELECTOR || ''
    })
    console.log(`Capture ${name}: auto-start ${start.clicked ? 'clicked' : start.reason}`)
    await page.waitForTimeout(1000)
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      const title = document.querySelector('#title-screen')
      if (title) {
        const content = title.querySelector('.title-inner')
        if (window.innerWidth <= 700 && content) {
          title.style.alignItems = 'flex-start'
          title.style.justifyContent = 'flex-start'
        }
        title.scrollTop = 0
      }
    })
    await page.waitForTimeout(100)
    await page.screenshot({ path: join(output, `final-${name}.png`), timeout: 30000 }).catch(error => {
      if (error.name === 'TimeoutError' || !browser.isConnected()) transient(error)
      throw error
    })
    if (process.env.CAPTURE_STRICT !== '0' && failures.length) {
      throw new Error(`Published build failed: ${failures.join('; ')}`)
    }
    await page.close()
  }
} catch (error) {
  console.error(error)
  process.exitCode = error.exitCode || 1
} finally {
  await browser?.close().catch(error => {
    console.error(error)
    process.exitCode ||= 75
  })
}
