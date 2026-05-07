// src/components/history/HistoryView.jsx
// Shows every logged workout from the Google Sheet, newest first.
// Tap a date to expand full set breakdown. Tap "Edit" to open Quick Log
// for that day (re-opens with existing values pre-filled).

import React, { useMemo, useState } from 'react'
import {
  Calendar, ChevronRight, ChevronUp, RefreshCw, Pencil, AlertCircle, Heart, Activity,
} from 'lucide-react'
import { useSheetData } from '../../lib/useSheetData'
import { toISODate, isConfigured, getSettings } from '../../lib/settings'
import useAppStore from '../../store/useAppStore'

export default function HistoryView() {
  const { rows, loading, error, refresh } = useSheetData()
  const openQuickLog = useAppStore(s => s.openQuickLog)
  const [expanded, setExpanded] = useState(null)

  const sessions = useMemo(() => groupByDate(rows), [rows])
  const phaseEvents = useMemo(() => {
    const h = getSettings().phaseHistory || []
    const map = {}
    for (const e of h) (map[e.isoDate] ||= []).push(e)
    return map
  }, [])

  if (!isConfigured()) {
    return (
      <EmptyState
        icon={<AlertCircle size={28} className="text-warn" />}
        title="Not configured"
        subtitle="Open Settings from the calendar to connect your Apps Script URL."
      />
    )
  }

  if (error && !rows.length) {
    return (
      <EmptyState
        icon={<AlertCircle size={28} className="text-danger" />}
        title="Couldn't load history"
        subtitle={error.message === 'not-configured'
          ? 'Open Settings from the calendar to connect.'
          : error.message}
        action={<button onClick={refresh} className="mt-4 text-accent text-sm font-semibold">Try again</button>}
      />
    )
  }

  if (!sessions.length && !loading) {
    return (
      <EmptyState
        icon={<Calendar size={28} className="text-txt-muted" />}
        title="No workouts logged yet"
        subtitle="Use Quick Log from the calendar to record a session."
      />
    )
  }

  // Group sessions by month for visual chunks
  const byMonth = {}
  for (const s of sessions) {
    const key = monthKey(s.iso)
    ;(byMonth[key] ||= []).push(s)
  }

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      <div className="px-4 pt-5 pb-3 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-white">History</h1>
          <p className="text-xs text-txt-secondary mt-0.5">
            {sessions.length} workout{sessions.length !== 1 ? 's' : ''} logged
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1 text-[11px] text-txt-muted hover:text-white px-2 py-1"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Syncing' : 'Refresh'}
        </button>
      </div>

      {Object.entries(byMonth).map(([month, list]) => (
        <div key={month}>
          <p className="px-4 py-2 text-[10px] font-semibold text-txt-muted uppercase tracking-widest">
            {month}
          </p>
          <div className="px-4 space-y-1.5">
            {list.map(session => {
              const isOpen = expanded === session.iso
              const phaseEvts = phaseEvents[session.iso] || []
              return (
                <div key={session.iso} className="bg-bg-1 border border-bg-3 rounded-xl overflow-hidden">
                  {phaseEvts.map((e, i) => (
                    <PhaseChangeChip key={i} event={e} />
                  ))}
                  <button
                    onClick={() => setExpanded(isOpen ? null : session.iso)}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left"
                  >
                    <DatePill iso={session.iso} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{session.workoutType}</span>
                      </div>
                      <p className="text-[11px] text-txt-muted mt-0.5">
                        {session.totalSets} sets · {session.exerciseCount} exercises
                        {session.topLifts && <> · {session.topLifts}</>}
                      </p>
                    </div>
                    {isOpen
                      ? <ChevronUp size={16} className="text-txt-muted flex-shrink-0" />
                      : <ChevronRight size={16} className="text-txt-muted flex-shrink-0" />
                    }
                  </button>

                  {isOpen && (
                    <div className="border-t border-bg-3 px-3 py-3 space-y-3">
                      {session.exercises.map(ex => (
                        <div key={ex.name}>
                          <p className="text-[12px] font-bold text-accent-light mb-1.5">{ex.name}</p>
                          <div className="space-y-1 pl-1">
                            {ex.sets.map((st, i) => (
                              <div key={i} className="flex items-baseline gap-3 text-[12px] tabular-nums">
                                <span className="w-4 text-txt-muted">{st.set_num ?? i + 1}</span>
                                <span className="font-semibold text-white">{fmtNum(st.weight_kg)}</span>
                                <span className="text-txt-muted">kg ×</span>
                                <span className="text-txt-secondary">{fmtNum(st.reps)}</span>
                                {!isBlank(st.rpe) && (
                                  <span className="text-txt-muted">RPE {fmtNum(st.rpe)}</span>
                                )}
                                {st.notes && (
                                  <span className="text-txt-muted italic truncate">"{st.notes}"</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={() => openQuickLog(session.iso)}
                        className="flex items-center gap-1.5 text-xs text-accent-light hover:text-accent mt-1"
                      >
                        <Pencil size={12} /> Edit in Quick Log
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────

function PhaseChangeChip({ event }) {
  const Icon = event.to === 'until-recovery' ? Heart : Activity
  const color = event.to === 'until-recovery' ? 'warn' : 'accent-light'
  const label = event.to === 'until-recovery'
    ? 'Switched to Recovery Phase'
    : 'Switched to Original Phase'
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 border-b border-bg-3 bg-bg-2/40 text-${color} text-[11px]`}>
      <Icon size={11} />
      <span className="font-semibold">{label}</span>
    </div>
  )
}

function DatePill({ iso }) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dayName = date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()
  return (
    <div className="w-11 h-11 bg-bg-2 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
      <span className="text-[9px] text-txt-muted font-bold leading-none">{dayName}</span>
      <span className="text-base font-bold text-white leading-none mt-0.5">{d}</span>
    </div>
  )
}

function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-20 h-20 bg-bg-1 border border-bg-3 rounded-full flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-white font-semibold text-lg">{title}</p>
      {subtitle && <p className="text-txt-secondary text-sm mt-1 max-w-xs">{subtitle}</p>}
      {action}
    </div>
  )
}

function groupByDate(rows) {
  const byDate = {}
  for (const r of rows) {
    if (!r.date) continue
    const iso = toISODate(new Date(r.date))
    ;(byDate[iso] ||= []).push(r)
  }
  return Object.keys(byDate)
    .sort((a, b) => (a < b ? 1 : -1))
    .map(iso => {
      const list = byDate[iso]
      const workoutType = firstNonBlank(list.map(r => r.workout_type)) || 'Workout'
      // Group by exercise preserving order of first appearance
      const orderedExercises = []
      const seen = {}
      for (const r of list) {
        const name = r.exercise || '—'
        if (!seen[name]) {
          seen[name] = { name, sets: [] }
          orderedExercises.push(seen[name])
        }
        seen[name].sets.push(r)
      }
      for (const ex of orderedExercises) {
        ex.sets.sort((a, b) => (Number(a.set_num) || 0) - (Number(b.set_num) || 0))
      }
      const totalSets = list.length
      const topLifts = orderedExercises.slice(0, 2).map(e => e.name).join(' · ')
      return {
        iso,
        workoutType,
        totalSets,
        exerciseCount: orderedExercises.length,
        exercises: orderedExercises,
        topLifts,
      }
    })
}

function monthKey(iso) {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function firstNonBlank(arr) {
  for (const v of arr) if (v != null && v !== '') return String(v)
  return null
}

function isBlank(v) { return v == null || v === '' }
function fmtNum(v) {
  if (isBlank(v)) return '—'
  const n = Number(v)
  return Number.isNaN(n) ? String(v) : String(n)
}
