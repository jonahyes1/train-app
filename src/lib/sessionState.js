// src/lib/sessionState.js
// Tiny helper that scans localStorage for in-progress Guided Sessions.
// Used by the calendar to surface "Resume" affordances on days that have
// at least one logged-but-not-yet-finished set still sitting in storage.
//
// Storage shape (set by GuidedSession):
//   key:    trainapp:session:<iso>:<workoutType>
//   value:  { state, currentIdx, startedAt, pause }
//
// A session is considered "paused / resumable" if at least one set in its
// state has logged === true. Sessions with zero logged sets are treated as
// abandoned drafts and ignored.

const PREFIX = 'trainapp:session:'

/** Map of iso → { workoutType, totalLogged, totalPlanned, startedAt }. */
export function getPausedSessions() {
  const out = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(PREFIX)) continue

      const rest = key.slice(PREFIX.length)
      const firstColon = rest.indexOf(':')
      if (firstColon < 0) continue
      const iso = rest.slice(0, firstColon)
      const workoutType = rest.slice(firstColon + 1)

      try {
        const parsed = JSON.parse(localStorage.getItem(key))
        if (!parsed?.state || !Array.isArray(parsed.state)) continue
        let totalLogged = 0
        let totalPlanned = 0
        for (const ex of parsed.state) {
          for (const s of (ex.sets || [])) {
            totalPlanned++
            if (s.logged) totalLogged++
          }
        }
        if (totalLogged > 0) {
          out[iso] = {
            workoutType,
            totalLogged,
            totalPlanned,
            startedAt: parsed.startedAt || null,
            paused: parsed.pause?.pausedAtMs != null,
          }
        }
      } catch {}
    }
  } catch {}
  return out
}

/** Boolean check for a single date. */
export function hasPausedSession(iso) {
  return !!getPausedSessions()[iso]
}

/** Lookup for a single date or null. */
export function getPausedSession(iso) {
  return getPausedSessions()[iso] || null
}

/** Manually clear an in-progress session — used if the user explicitly
 *  abandons one ("discard paused session" UI not yet shipped, but the
 *  helper exists). */
export function clearPausedSession(iso, workoutType) {
  try { localStorage.removeItem(`${PREFIX}${iso}:${workoutType}`) } catch {}
}
