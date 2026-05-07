// src/lib/sheets.js
// Google Apps Script bridge — JSONP for reads (no CORS), POST for writes.

import { getSettings } from './settings'

// ─── JSONP (read) ──────────────────────────────────────────────────
// Apps Script doGet supports ?callback=fn for JSONP. We create a unique
// global function, inject a <script> tag, and resolve when it fires.
let jsonpCounter = 0
export function jsonp(url, params = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const cbName = `__sheets_cb_${Date.now()}_${jsonpCounter++}`
    const qs = new URLSearchParams({ ...params, callback: cbName }).toString()
    const sep = url.includes('?') ? '&' : '?'
    const fullUrl = `${url}${sep}${qs}`

    const script = document.createElement('script')
    let timer = null

    const cleanup = () => {
      delete window[cbName]
      if (script.parentNode) script.parentNode.removeChild(script)
      if (timer) clearTimeout(timer)
    }

    window[cbName] = (data) => {
      cleanup()
      resolve(data)
    }

    script.onerror = () => {
      cleanup()
      reject(new Error('JSONP network error'))
    }

    timer = setTimeout(() => {
      cleanup()
      reject(new Error('JSONP timeout'))
    }, timeoutMs)

    script.src = fullUrl
    document.head.appendChild(script)
  })
}

// ─── High-level API ────────────────────────────────────────────────
function requireUrl() {
  const { appsScriptUrl } = getSettings()
  if (!appsScriptUrl) throw new Error('Apps Script URL not configured. Open Settings.')
  return appsScriptUrl
}

function requirePassword() {
  const { password } = getSettings()
  if (!password) throw new Error('Password not configured. Open Settings.')
  return password
}

/**
 * Fetch all rows from the sheet (optionally filtered).
 * Returns array of row objects keyed by header.
 *
 * Accepts either response shape:
 *   A. Raw array: [{...}, {...}]                          (current Apps Script)
 *   B. Envelope:  { ok: true, rows: [...] }              (future upgraded script)
 *   C. Error:     { ok: false, error: 'msg' }
 *
 * Client-side filtering for `since` / `workout_type` in case the script
 * doesn't support query-param filtering.
 */
export async function fetchRows({ since, workout_type } = {}) {
  const url = requireUrl()
  const params = {}
  if (since) params.since = since
  if (workout_type) params.workout_type = workout_type
  const res = await jsonp(url, params)

  let rows
  if (Array.isArray(res)) {
    rows = res
  } else if (res && typeof res === 'object') {
    if (res.ok === false) throw new Error(res.error || 'Fetch failed')
    rows = res.rows || []
  } else {
    throw new Error('Unexpected response shape')
  }

  // Defensive client-side filtering (in case server didn't filter).
  if (since) {
    const t = new Date(since).getTime()
    rows = rows.filter(r => r.date && new Date(r.date).getTime() >= t)
  }
  if (workout_type) {
    rows = rows.filter(r => String(r.workout_type) === workout_type)
  }
  return rows
}

/**
 * Post one flat row in the format the existing Apps Script doPost expects:
 *   { secret, date, workout_type, exercise, set_num, weight_kg, reps, rpe, notes }
 * Returns "OK" (plain text) on success.
 *
 * NOTE: text/plain content-type avoids CORS preflight; Apps Script reads
 * e.postData.contents raw regardless of content-type.
 */
async function postOne(row) {
  const url = requireUrl()
  const secret = requirePassword()
  const body = { secret, ...row }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
  })
  const text = await res.text()
  // Current doPost returns "OK" as plain text. If it's ever upgraded to return
  // JSON {ok: true}, handle that too.
  if (text === 'OK') return { ok: true }
  try {
    const data = JSON.parse(text)
    if (data.ok === false) throw new Error(data.error || 'POST failed')
    return data
  } catch (e) {
    // Not JSON — probably an unauthorized plain-text response
    if (text.toLowerCase().includes('unauthorized')) throw new Error('Unauthorized — check password in Settings')
    throw new Error(e.message || text || 'POST failed')
  }
}

/** Append a single set log. */
export function logSet({ date, workout_type, exercise, set_num, weight_kg, reps, rpe, notes = '' }) {
  return postOne({ date, workout_type, exercise, set_num, weight_kg, reps, rpe, notes })
}

/**
 * Save many sets sequentially using the legacy single-row POST.
 * Append-only — will create duplicate rows if re-run for the same session.
 * Prefer saveSessionBatch once the Apps Script upgrade is deployed.
 */
export async function saveSession(rows) {
  let succeeded = 0
  const failures = []
  for (const r of rows) {
    try {
      await postOne(r)
      succeeded++
    } catch (e) {
      failures.push({ row: r, error: e.message })
    }
  }
  return { succeeded, failed: failures.length, failures }
}

/**
 * Save a whole session in one request using the upsert-capable doPost
 * (see APPS_SCRIPT_DEPLOY.md). Re-saving the same day updates existing
 * rows instead of appending duplicates.
 *
 * Key: date|workout_type|exercise|set_num.
 * Auto-falls-back to sequential postOne() if the server returns a
 * "unknown action" error (i.e. script hasn't been upgraded yet).
 */
export async function saveSessionBatch(rows) {
  const url = requireUrl()
  const secret = requirePassword()
  const body = {
    secret,
    action: 'upsert',
    upsertKey: 'date|workout_type|exercise|set_num',
    rows,
  }

  let res, text
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
    })
    text = await res.text()
  } catch (e) {
    throw new Error('Network error: ' + e.message)
  }

  // Try JSON first (upgraded script)
  try {
    const data = JSON.parse(text)
    if (data.ok === true) {
      return {
        ok: true,
        mode: 'upsert',
        updated: data.updated || 0,
        appended: data.appended || 0,
      }
    }
    if (data.ok === false) {
      // If script rejects the action, fall back to per-row legacy posts.
      if (/unknown action/i.test(data.error || '')) {
        return fallbackLegacy(rows)
      }
      throw new Error(data.error || 'Save failed')
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      // Not JSON. Old script likely returned "OK" or "unauthorized".
      if (text.trim() === 'OK') {
        // Old script only stored the FIRST row. Resend the rest one-by-one.
        const [, ...rest] = rows
        const tail = await fallbackLegacy(rest)
        return {
          ok: tail.ok,
          mode: 'legacy-fallback',
          succeeded: 1 + tail.succeeded,
          failed: tail.failed,
          failures: tail.failures,
        }
      }
      if (text.toLowerCase().includes('unauthorized')) {
        throw new Error('Unauthorized — check password in Settings.')
      }
      throw new Error('Unexpected response: ' + text.slice(0, 140))
    }
    throw e
  }
}

/**
 * Permanently dedupes the underlying Google Sheet by (date, workout_type,
 * exercise, set_num). Keeps the most-recently-timestamped row per group
 * and deletes the rest. Requires the upgraded Apps Script (see
 * APPS_SCRIPT_DEPLOY.md → action: "clean-duplicates").
 */
export async function cleanDuplicates() {
  const url = requireUrl()
  const secret = requirePassword()
  const body = { secret, action: 'clean-duplicates' }

  let res, text
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
    })
    text = await res.text()
  } catch (e) {
    throw new Error('Network error: ' + e.message)
  }

  try {
    const data = JSON.parse(text)
    if (data.ok === true) return data
    if (data.ok === false) {
      if (/unknown action/i.test(data.error || '')) {
        throw new Error(
          'Apps Script needs an upgrade. Open Settings → Apps Script setup ' +
          'instructions and paste the latest Code.gs.'
        )
      }
      throw new Error(data.error || 'Clean failed')
    }
    throw new Error('Unexpected response: ' + text.slice(0, 140))
  } catch (e) {
    if (e instanceof SyntaxError) {
      if (text.toLowerCase().includes('unauthorized')) {
        throw new Error('Unauthorized — check password in Settings.')
      }
      throw new Error('Unexpected response: ' + text.slice(0, 140))
    }
    throw e
  }
}

async function fallbackLegacy(rows) {
  let succeeded = 0
  const failures = []
  for (const r of rows) {
    try {
      await postOne(r)
      succeeded++
    } catch (e) {
      failures.push({ row: r, error: e.message })
    }
  }
  return { ok: failures.length === 0, mode: 'legacy', succeeded, failed: failures.length, failures }
}
