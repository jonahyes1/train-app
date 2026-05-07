// src/lib/dedupe.js
// Collapses sheet rows that share the same logical key
// (date | workout_type | exercise | set_num), keeping the most recent
// version by timestamp. Protects every UI surface from leftover
// duplicates that were appended by older saves before the upsert
// upgrade was deployed.

export function dedupeRows(rows) {
  const map = new Map()
  rows.forEach((r, i) => {
    const setNum = String(r.set_num ?? '').trim()
    if (!setNum) {
      // Without a set_num we can't safely dedupe; preserve the row.
      map.set(`__nokey_${i}`, r)
      return
    }
    const k = [
      String(r.date || ''),
      String(r.workout_type || ''),
      String(r.exercise || ''),
      setNum,
    ].join('')
    const cur = map.get(k)
    if (!cur || tsValue(r.timestamp) >= tsValue(cur.timestamp)) {
      map.set(k, r)
    }
  })
  return [...map.values()]
}

function tsValue(t) {
  if (!t) return 0
  if (t instanceof Date) return t.getTime()
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? 0 : d.getTime()
}
