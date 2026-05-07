// src/components/session/PostSessionSummary.jsx
// Shown right after Finish & Save in Guided Session. For each exercise the
// user logged, displays today's top set side-by-side with the suggestion
// engine's prediction for next session. One tap to dismiss.

import React from 'react'
import { CheckCircle2, ChevronRight, Sparkles, TrendingUp } from 'lucide-react'
import { suggestNext } from '../../lib/suggest'

export default function PostSessionSummary({
  workoutType,
  loggedRows,             // rows just saved
  rows,                   // full sheet rows incl. today (for suggestion engine)
  exercises,              // program exercises (with categories)
  durationSec,
  onDone,
}) {
  // Build per-exercise summary: today's top set + suggestion for next.
  const byExercise = {}
  for (const r of loggedRows) (byExercise[r.exercise] ||= []).push(r)

  const items = []
  for (const ex of exercises) {
    const sets = byExercise[ex.name]
    if (!sets || !sets.length) continue
    sets.sort((a, b) => (Number(a.set_num) || 0) - (Number(b.set_num) || 0))
    const topSet = sets.reduce((acc, s) => {
      const w = Number(s.weight_kg) || 0
      return w > (acc.w || 0) ? { w, r: Number(s.reps) || 0 } : acc
    }, { w: 0, r: 0 })
    const suggestion = suggestNext(ex, rows)
    items.push({
      name: ex.name,
      group: ex.group,
      todayTop: topSet,
      suggestion,
    })
  }

  const mins = Math.floor((durationSec || 0) / 60)
  const secs = (durationSec || 0) % 60
  const durationLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      <div className="px-5 pt-6 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={24} className="text-success" />
          <h2 className="text-white font-bold text-xl">Session Complete</h2>
        </div>
        <div className="text-txt-secondary text-sm mt-1">
          {workoutType} · {loggedRows.length} sets · {durationLabel}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-txt-muted font-bold mb-1 px-1">
          Today → Next Session
        </div>
        {items.map(it => (
          <div key={it.name} className="bg-bg-1 border border-bg-3 rounded-xl px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-accent-light">{it.group}</div>
            <div className="text-white font-semibold text-sm mt-0.5">{it.name}</div>
            <div className="flex items-center gap-2 text-[12px] mt-1.5 tabular-nums">
              <div className="text-white">
                Today: <span className="font-bold">{fmtTop(it.todayTop)}</span>
              </div>
              <ChevronRight size={12} className="text-txt-muted" />
              <div className={it.suggestion.plateau ? 'text-warn' : 'text-accent-light'}>
                Next: <span className="font-bold">{it.suggestion.headline}</span>
              </div>
            </div>
            <div className="text-[11px] text-txt-muted italic mt-0.5 leading-snug flex items-start gap-1">
              {it.suggestion.plateau ? <TrendingUp size={10} className="mt-0.5" /> : <Sparkles size={10} className="mt-0.5" />}
              <span>{it.suggestion.reason}</span>
            </div>
          </div>
        ))}
        <div className="h-8" />
      </div>

      <div className="flex-shrink-0 px-3 py-3 bg-bg-1 border-t border-bg-3">
        <button
          onClick={onDone}
          className="w-full bg-accent hover:bg-accent-dark text-white font-semibold rounded-xl py-3"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function fmtTop({ w, r }) {
  if (!w && !r) return '—'
  if (!w) return `${r} reps`
  return `${w}kg × ${r}`
}
