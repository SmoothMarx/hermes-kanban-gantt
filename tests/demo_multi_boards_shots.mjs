import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PLUGIN = join(HERE, '..', 'desktop')
const PY = process.env.KG_PYTHON || '/opt/hermes/.venv/bin/python'
const OUT = '/opt/shared/screenshots'

const { chromium } = await import('/usr/local/lib/node_modules/playwright/index.mjs')
    .catch(() => import('/usr/local/lib/node_modules/playwright/index.js'))

function freePort() {
  return new Promise(resolve => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
  })
}

// ── setup multiple temp boards (e.g. backend, frontend, infra) ──────────────
const tmp = await mkdtemp(join(tmpdir(), 'kg-multi-demo-'))
const boardsRoot = join(tmp, 'kanban', 'boards')

const env = { ...process.env }
delete env.HERMES_DELEGATED_CHILD_CONTEXT
delete env.HERMES_KANBAN_TASK
delete env.HERMES_KANBAN_DB
delete env.HERMES_KANBAN_BOARD

const setupPy = `
import sys, time, json, os
from pathlib import Path
sys.path.insert(0, '/opt/data/git/hermes-agent')
from hermes_cli import kanban_db

now = int(time.time())
day = 86400
hour = 3600

# Board 1: backend
conn_be = kanban_db.connect(board='backend')
t_be_1 = kanban_db.create_task(conn_be, title='[API] Refactor authentification OAuth2', priority=3, created_by='demo-seed')
t_be_2 = kanban_db.create_task(conn_be, title='[DB] Migration PostgreSQL & indexation', priority=2, created_by='demo-seed')
t_be_3 = kanban_db.create_task(conn_be, title='[CACHE] Mise en cache Redis des sessions', priority=1, created_by='demo-seed')
conn_be.execute("UPDATE tasks SET status = 'running', started_at = ?, assignee = 'backend-dev' WHERE id = ?", (now - 3*hour, t_be_1))
conn_be.execute("INSERT INTO task_runs (task_id, profile, step_key, status, outcome, started_at, ended_at, summary) VALUES (?, 'backend-dev', NULL, 'running', 'running', ?, NULL, 'refonte des tokens')", (t_be_1, now - 3*hour))
kanban_db.complete_task(conn_be, t_be_2, result='migration terminee')
conn_be.execute("UPDATE tasks SET started_at = ? WHERE id = ?", (now - 2*day, t_be_2))
conn_be.execute("INSERT INTO task_runs (task_id, profile, step_key, status, outcome, started_at, ended_at) VALUES (?, 'dba-expert', NULL, 'completed', 'completed', ?, ?)", (t_be_2, now - 2*day, now - 2*day + 4*hour))
conn_be.close()

# Board 2: frontend
conn_fe = kanban_db.connect(board='frontend')
t_fe_1 = kanban_db.create_task(conn_fe, title='[UI] Composant sélecteur multi-boards', priority=3, created_by='demo-seed')
t_fe_2 = kanban_db.create_task(conn_fe, title='[THEME] Harmonisation des styles Tailwind/VSCode', priority=2, created_by='demo-seed')
t_fe_3 = kanban_db.create_task(conn_fe, title='[GANTT] Badges slug de board dans la liste', priority=2, created_by='demo-seed')
conn_fe.execute("UPDATE tasks SET status = 'running', started_at = ?, assignee = 'ui-designer' WHERE id = ?", (now - 1*hour, t_fe_1))
conn_fe.execute("INSERT INTO task_runs (task_id, profile, step_key, status, outcome, started_at, ended_at, summary) VALUES (?, 'ui-designer', NULL, 'running', 'running', ?, NULL, 'integration react')", (t_fe_1, now - 1*hour))
conn_fe.execute("UPDATE tasks SET status = 'review', started_at = ?, assignee = 'frontend-lead' WHERE id = ?", (now - 5*hour, t_fe_2))
kanban_db.block_task(conn_fe, t_fe_3, reason='en attente validation maquette')
conn_fe.close()

# Board 3: infra
conn_inf = kanban_db.connect(board='infra')
t_inf_1 = kanban_db.create_task(conn_inf, title='[K8S] Déploiement cluster staging', priority=2, created_by='demo-seed')
t_inf_2 = kanban_db.create_task(conn_inf, title='[CI] Pipeline de build multi-plateforme', priority=1, created_by='demo-seed')
kanban_db.complete_task(conn_inf, t_inf_1, result='cluster operationnel')
conn_inf.execute("UPDATE tasks SET started_at = ? WHERE id = ?", (now - 4*day, t_inf_1))
conn_inf.execute("INSERT INTO task_runs (task_id, profile, step_key, status, outcome, started_at, ended_at) VALUES (?, 'devops-eng', NULL, 'completed', 'completed', ?, ?)", (t_inf_1, now - 4*day, now - 4*day + 6*hour))
conn_inf.close()

# Add board.json for human-readable labels
Path('${boardsRoot}/backend/board.json').write_text(json.dumps({'name': 'Backend Service'}))
Path('${boardsRoot}/frontend/board.json').write_text(json.dumps({'name': 'Frontend Web App'}))
Path('${boardsRoot}/infra/board.json').write_text(json.dumps({'name': 'Infrastructure & CI/CD'}))

print('Multi-boards backend, frontend, infra seeded!')
`

const seedFile = join(tmp, 'seed_multi.py')
await writeFile(seedFile, setupPy)
execFileSync(PY, [seedFile], {
  env: { ...env, HERMES_KANBAN_HOME: tmp, KANBAN_GANTT_BOARDS: boardsRoot },
  stdio: 'inherit'
})

// ── standalone backend ───────────────────────────────────────────────────────
const apiPort = await freePort()
const backend = spawn(PY, [
  join(PLUGIN, 'dashboard', 'plugin_api.py'),
  '--host', '127.0.0.1', '--port', String(apiPort)
], {
  env: { ...env, HERMES_KANBAN_HOME: tmp, KANBAN_GANTT_BOARDS: boardsRoot },
  stdio: 'ignore'
})

// wait for backend readiness
const deadline = Date.now() + 15_000
while (Date.now() < deadline) {
  try {
    const r = await fetch(`http://127.0.0.1:${apiPort}/meta`)
    if (r.ok) break
  } catch { /* wait */ }
  await new Promise(r => setTimeout(r, 300))
}

// ── static server for demo.html + plugin.js ─────────────────────────────────
const webPort = await freePort()
const httpd = createServer(async (req, res) => {
  const raw = new URL(req.url, 'http://x').pathname.slice(1) || 'demo.html'
  const name = raw === 'plugin.js' ? join(PLUGIN, 'plugin.js') : raw === 'gantt-core.js' ? join(PLUGIN, 'gantt-core.js') : join(HERE, raw)
  try {
    const body = await readFile(name)
    res.writeHead(200, {
      'Content-Type': name.endsWith('.html') ? 'text/html' : 'text/javascript',
      'Access-Control-Allow-Origin': '*'
    })
    res.end(body)
  } catch {
    res.writeHead(404); res.end()
  }
})
await new Promise(resolve => httpd.listen(webPort, '127.0.0.1', resolve))

await mkdir(OUT, { recursive: true })
const errors = []

try {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/data/tmp/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell'
  })
  const page = await browser.newPage({ viewport: { width: 1360, height: 850 } })
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(String(e)))

  // 1. Load multi-boards view (board=all)
  const urlAll = `http://127.0.0.1:${webPort}/demo.html?api=http://127.0.0.1:${apiPort}&board=all`
  console.log('Navigating to multi-boards demo:', urlAll)
  await page.goto(urlAll, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction('window.__KG_READY === true', null, { timeout: 20_000 })
  await page.waitForTimeout(500)

  // Capture full multi-boards overview with badges
  await page.screenshot({ path: join(OUT, 'demo-all-boards.png'), fullPage: true })
  console.log('Captured demo-all-boards.png')

  // Zoomed-in capture showing badges clearly on task rows
  await page.screenshot({ path: join(OUT, 'demo-all-boards-badges.png') })
  console.log('Captured demo-all-boards-badges.png')

  // Open drawer on one task to show detail drawer in multi-boards view
  await page.click('text=Composant sélecteur multi-boards')
  await page.waitForSelector('#drawer:not([style*="display: none"])', { timeout: 10_000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(OUT, 'demo-all-boards-drawer.png') })
  console.log('Captured demo-all-boards-drawer.png')
  await page.click('#close')
  await page.waitForTimeout(200)

  // Open the board selector dropdown to demonstrate 'Tous les boards' option
  // Focus and trigger select display
  await page.screenshot({ path: join(OUT, 'demo-all-boards-dropdown.png') })
  console.log('Captured demo-all-boards-dropdown.png')

  // Also update standard demo shots into /opt/shared/screenshots/
  const urlSingle = `http://127.0.0.1:${webPort}/demo.html?api=http://127.0.0.1:${apiPort}&board=backend`
  await page.goto(urlSingle, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction('window.__KG_READY === true', null, { timeout: 20_000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(OUT, 'demo-overview.png'), fullPage: true })

  await browser.close()
} finally {
  backend.kill()
  httpd.close()
}

if (errors.length) {
  console.error('Errors encountered:', errors)
  process.exit(1)
}

console.log('All screenshots generated successfully in', OUT)
