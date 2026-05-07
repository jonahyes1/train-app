import React, { useState } from 'react'
import { Clock, ChevronRight, X } from 'lucide-react'
import { toISODate } from '../../lib/settings'
import { useSheetData } from '../../lib/useSheetData'

export default function LastSessionBanner({ workoutType, lastSession, selectedISO }) {
  const [sheetOpen, setSheetOpen] = useState(false)

  if (!workoutType || isRestType(workoutType)) return null

  const daysAgo = lastSession
    ? daysBetween(new Date(lastSession.date + 'T00:00:00'), new Date())
    : null

  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        className="w-full flex items-center gap-3 bg-bg-1 border border-bg-3 rounded-xl px-3 py-2.5 hover:border-bg-5 text-left"
      >
        <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
          <Clock size={14} className="text-accent-light" />
        </div>
        <div className="flex-1 min-w-0">
          {lastSession ? (
            <>
              <div className="text-[10px] uppercase tracking-wider text-txt-muted">
                Last {workoutType}
              </div>
              <div className="text-white text-sm font-semibold truncate">
                {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`}
                <span className="text-txt-secondary font-normal"> · {prettyDate(lastSession.date)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-wider text-txt-muted">
                {workoutType}
              </div>
              <div className="text-white text-sm font-semibold">No prior session</div>
            </>
          )}
        </div>
        <ChevronRight size={16} className="text-txt-muted flex-shrink-0" />
      </button>

      <HistorySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        workoutType={workoutType}
      />
    </>
  )
}

// ─── History sheet (last 10 sessions) ──────────────────────────────
function HistorySheet({ open, onClose, workoutType }) {
  const { rows } = useSheetData()
  if (!open) return null

  const sessions = groupByDate(rows, workoutType).slice(0, 10)

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-bg-1 w-full sm:max-w-md rounded-t-2xl border-t border-x border-bg-3 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-3 flex-shrink-0">
          <h3 className="text-white font-bold">{workoutType} · Recent sessions</h3>
          <button onClick={onClose} className="p-1 text-txt-muted hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {sessions.length === 0 ? (
            <p className="text-txt-muted text-sm text-center py-10">No sessions yet.</p>
          ) : (
            sessions.map((s) => (
              <div key={s.date} className="px-3 py-2.5 border-b border-bg-3 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-white text-sm font-semibold">{prettyDate(s.date)}</div>
                  <div className="text-[11px] text-txt-muted">{s.sets.length} sets</div>
                </div>
                <div className="text-[11px] text-txt-secondary space-y-0.5">
                  {aggregateByExercise(s.sets).map((e) => (
                    <div key={e.exercise} className="flex items-center justify-between gap-2">
                      <span className="truncate">{e.exercise}</span>
                      <span className="text-txt-muted flex-shrink-0">
                        {e.count}×{e.topWeight}kg · {e.reps} reps
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────
function isRestType(t) {
  const s = String(t || '').toLowerCase()
  return !t || s === 'rest' || s === 'off' || s === '—'
}

function daysBetween(a, b) {
  const ms = new Date(b.getFullYear(), b.getMonth(), b.getDate()) -
             new Date(a.getFullYear(), a.getMonth(), a.getDate())
  return Math.round(ms / 86400000)
}

function prettyDate(iso) {
  const d = typeof iso === 'string' ? new Date(iso + 'T00:00:00') : new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function groupByDate(rows, workoutType) {
  const map = {}
  for (const r of rows) {
    if (String(r.workout_type) !== workoutType) continue
    if (!r.date) continue
    const iso = toISODate(new Date(r.date))
    if (!map[iso]) map[iso] = []
    map[iso].push(r)
  }
  return Object.entries(map)
    .map(([date, sets]) => ({ date, sets }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

function aggregateByExercise(sets) {
  const m = {}
  for (const s of sets) {
    const k = s.exercise || '?'
    if (!m[k]) m[k] = { exercise: k, count: 0, topWeight: 0, reps: 0 }
    m[k].count += 1
    const w = parseFloat(s.weight_kg) || 0
    if (w > m[k].topWeight) m[k].topWeight = w
    m[k].reps += parseInt(s.reps) || 0
  }
  return Object.values(m)
}
