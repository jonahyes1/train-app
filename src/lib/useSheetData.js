// src/lib/useSheetData.js
// React hook that fetches all sheet rows and keeps an in-memory cache.
// Re-fetches on demand, on focus, and when settings change.

import { useEffect, useState, useCallback } from 'react'
import { fetchRows } from './sheets'
import { isConfigured, toISODate } from './settings'
import { dedupeRows } from './dedupe'

const CACHE_KEY = 'trainapp:sheet-cache:v2' // bumped to drop dirty cached duplicates
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function readCache() {
  try {
    // Clean up any pre-v2 cache key (held duplicates from older builds).
    try { localStorage.removeItem('trainapp:sheet-cache:v1') } catch {}
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { rows, fetchedAt } = JSON.parse(raw)
    if (Date.now() - fetchedAt > CACHE_TTL_MS) return null
    return rows
  } catch { return null }
}

function writeCache(rows) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rows, fetchedAt: Date.now() }))
  } catch {}
}

export function useSheetData() {
  const [rows, setRows] = useState(() => readCache() || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!isConfigured()) {
      setError(new Error('not-configured'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      const raw = await fetchRows()
      // Collapse legacy duplicates from earlier append-only saves so every
      // screen sees one row per (date, workout_type, exercise, set_num).
      const r = dedupeRows(raw)
      setRows(r)
      writeCache(r)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + refresh on settings change + on tab focus
  useEffect(() => {
    refresh()
    const onSettings = () => refresh()
    const onFocus = () => refresh()
    window.addEventListener('settings-changed', onSettings)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('settings-changed', onSettings)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  return { rows, loading, error, refresh }
}

// ─── Derived views ──────────────────────────────────────────────────

/** Map of 'YYYY-MM-DD' → array of rows logged that day. */
export function rowsByDate(rows) {
  const m = {}
  for (const r of rows) {
    if (!r.date) continue
    const iso = toISODate(new Date(r.date))
    if (!m[iso]) m[iso] = []
    m[iso].push(r)
  }
  return m
}

/** Most recent logged session for a given workout_type, or null. */
export function lastSessionForType(rows, workoutType) {
  const matches = rows
    .filter(r => String(r.workout_type) === workoutType && r.date)
    .map(r => ({ ...r, _t: new Date(r.date).getTime() }))
    .sort((a, b) => b._t - a._t)
  if (!matches.length) return null
  const mostRecent = matches[0]
  const mostRecentDate = toISODate(new Date(mostRecent.date))
  const sets = matches.filter(r => toISODate(new Date(r.date)) === mostRecentDate)
  return { date: mostRecentDate, sets }
}
