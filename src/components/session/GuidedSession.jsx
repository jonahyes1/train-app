// src/components/session/GuidedSession.jsx
// Guided Workout: one exercise at a time, big Log-Set button, auto rest
// timer (Main=3min, Superset=75s) with a red ring under 10s, plus a
// running total-workout clock in the top bar. State is persisted to
// localStorage so closing the app doesn't lose progress.
//
// While a session is active we:
//   1. Acquire a Screen Wake Lock so the phone won't auto-lock (iOS 16.4+).
//   2. Play a short beep when the rest timer ends (even if the screen is
//      elsewhere, as long as the app is still in the foreground — iOS
//      throttles audio in background, which is an OS limitation).
//
// On Finish, all logged sets are committed in a single upsert call.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Check, SkipForward,
  Flag, Loader2, Trash2, Plus, AlertCircle, CheckCircle2, Timer,
  Sparkles, TrendingUp, X, Pause, Play, BookmarkCheck,
} from 'lucide-react'
import { exercisesFor, titleFor, phaseFor } from '../../lib/program'
import {
  workoutTypeForDate, toISODate,
  isSuggestionDismissed, dismissSuggestion, undismissSuggestion,
  getTrialStatus, setTrialStatus,
  recordOverrideOutcome, shouldPromptRecalibrate, setRecalibratedWeight,
} from '../../lib/settings'
import { saveSessionBatch } from '../../lib/sheets'
import { useSheetData } from '../../lib/useSheetData'
import { suggestNext } from '../../lib/suggest'
import useAppStore from '../../store/useAppStore'
import PostSessionSummary from './PostSessionSummary'

const REST_MAIN = 180     // 3 min for main lifts
const REST_SUPERSET = 75  // 75s within supersets

export default function GuidedSession() {
  const sessionISO = useAppStore(s => s.sessionISO) || toISODate(new Date())
  const endGuidedSession = useAppStore(s => s.endGuidedSession)
  const { rows, refresh } = useSheetData()

  const date = useMemo(() => isoToDate(sessionISO), [sessionISO])
  const workoutType = workoutTypeForDate(date)
  const phase = phaseFor(workoutType) || 'original'
  const allExercises = exercisesFor(workoutType)
  const exercises = useMemo(() => {
    return allExercises.filter(ex => {
      const t = getTrialStatus(phase, ex.name)
      return !t || t.status !== 'removed'
    })
  }, [allExercises, phase])

  // Last-session prefill per exercise
  const lastByExercise = useMemo(() => {
    const candidates = rows.filter(r =>
      String(r.workout_type) === workoutType &&
      r.date && toISODate(new Date(r.date)) !== sessionISO
    )
    if (!candidates.length) return {}
    const byDate = {}
    for (const r of candidates) {
      const iso = toISODate(new Date(r.date))
      ;(byDate[iso] ||= []).push(r)
    }
    const mostRecent = Object.keys(byDate).sort().pop()
    const batch = byDate[mostRecent] || []
    const map = {}
    for (const r of batch) (map[r.exercise] ||= []).push(r)
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (Number(a.set_num) || 0) - (Number(b.set_num) || 0))
    }
    return map
  }, [rows, workoutType, sessionISO])

  const storageKey = `trainapp:session:${sessionISO}:${workoutType}`

  // Initial load — returns { state, currentIdx, startedAt, pause }
  const [loaded] = useState(() => loadOrBuild(storageKey, exercises, lastByExercise))
  const [state, setState] = useState(loaded.state)
  const [currentIdx, setCurrentIdx] = useState(loaded.currentIdx)
  const [startedAt] = useState(loaded.startedAt)
  // Pause: { pausedAtMs: number|null, accumPauseMs: number }
  // When pausedAtMs is set, both the workout clock and any active rest timer freeze.
  const [pause, setPause] = useState(loaded.pause || { pausedAtMs: null, accumPauseMs: 0 })

  const [rest, setRest] = useState(null)
  const [finishing, setFinishing] = useState(false)
  const [result, setResult] = useState(null)
  const [trialPrompt, setTrialPrompt] = useState(null)
  const [recalPrompt, setRecalPrompt] = useState(null)
  const [summary, setSummary] = useState(null)   // { rows, durationSec }
  const [, forceTick] = useState(0)

  const togglePause = () => {
    setPause(p => {
      if (p.pausedAtMs == null) return { ...p, pausedAtMs: Date.now() }
      // Resume — accumulate the paused span
      return { pausedAtMs: null, accumPauseMs: p.accumPauseMs + (Date.now() - p.pausedAtMs) }
    })
  }
  const isPaused = pause.pausedAtMs != null

  // Suggestion per exercise
  const suggestions = useMemo(() => {
    const m = {}
    for (const ex of exercises) m[ex.name] = suggestNext(ex, rows)
    return m
  }, [exercises, rows])

  // Persist (including pause state so closing/reopening preserves it)
  useEffect(() => {
    if (!state) return
    try {
      localStorage.setItem(storageKey, JSON.stringify({ state, currentIdx, startedAt, pause }))
    } catch {}
  }, [state, currentIdx, startedAt, pause, storageKey])

  // ─── Screen Wake Lock ────────────────────────────────────────
  // Keep the phone from auto-locking while a session is active.
  useWakeLock(exercises.length > 0)

  if (!exercises.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-txt-secondary text-sm">
          {workoutType === 'Rest'
            ? 'Rest day. Nothing to train.'
            : `No exercises configured for "${workoutType}".`}
        </p>
        <button
          onClick={endGuidedSession}
          className="mt-4 text-accent text-sm font-semibold"
        >
          Back to calendar
        </button>
      </div>
    )
  }

  const current = state[currentIdx]
  const isLast = currentIdx === state.length - 1
  const loggedOnCurrent = current.sets.filter(s => s.logged).length
  const allLoggedOnCurrent = loggedOnCurrent === current.sets.length

  const totalLogged = state.reduce((n, ex) => n + ex.sets.filter(s => s.logged).length, 0)
  const totalPlanned = state.reduce((n, ex) => n + ex.sets.length, 0)

  const updateSet = (setIdx, patch) => {
    setState(s => {
      const next = [...s]
      const ex = { ...next[currentIdx] }
      ex.sets = ex.sets.map((st, i) => i === setIdx ? { ...st, ...patch } : st)
      next[currentIdx] = ex
      return next
    })
  }

  const logSet = (setIdx) => {
    const st = current.sets[setIdx]
    if (!st.weight_kg && !st.reps) return
    updateSet(setIdx, { logged: true, timestamp: Date.now() })
    const dur = restDurationFor(current.group)
    setRest({ duration: dur, startedAt: Date.now() })
  }

  const unlogSet = (setIdx) => updateSet(setIdx, { logged: false })

  const addSet = () => {
    setState(s => {
      const next = [...s]
      const ex = { ...next[currentIdx] }
      const last = ex.sets[ex.sets.length - 1]
      ex.sets = [...ex.sets, {
        weight_kg: last?.weight_kg ?? String(ex.target.weight || ''),
        reps: last?.reps ?? String(ex.target.reps || ''),
        rpe: '',
        notes: '',
        logged: false,
      }]
      next[currentIdx] = ex
      return next
    })
  }

  const removeSet = (setIdx) => {
    if (current.sets.length <= 1) return
    setState(s => {
      const next = [...s]
      const ex = { ...next[currentIdx] }
      ex.sets = ex.sets.filter((_, i) => i !== setIdx)
      next[currentIdx] = ex
      return next
    })
  }

  const goPrev = () => {
    setRest(null)
    setCurrentIdx(i => Math.max(0, i - 1))
  }
  const goNext = () => {
    setRest(null)
    setCurrentIdx(i => Math.min(state.length - 1, i + 1))
  }

  const handleFinish = async () => {
    setFinishing(true)
    setResult(null)
    const flat = []
    const trialsLogged = []
    const overrideRecords = []

    for (const ex of state) {
      const exDef = exercises.find(e => e.name === ex.exerciseName)
      const trial = getTrialStatus(phase, ex.exerciseName)
      const isPendingTrial = exDef?.trial && (!trial || trial.status === 'pending')

      const loggedSets = ex.sets.filter(s => s.logged)
      if (loggedSets.length && isPendingTrial) {
        trialsLogged.push(ex.exerciseName)
      }
      if (loggedSets.length && suggestions[ex.exerciseName] && !suggestions[ex.exerciseName].coldStart) {
        const top = loggedSets.reduce((acc, st) => {
          const w = Number(st.weight_kg) || 0
          return w > (acc.w || 0) ? { w, r: Number(st.reps) || 0 } : acc
        }, { w: 0, r: 0 })
        overrideRecords.push({
          name: ex.exerciseName,
          suggestion: suggestions[ex.exerciseName],
          weight: top.w,
          reps: top.r,
        })
      }

      ex.sets.forEach((st, i) => {
        if (!st.logged) return
        flat.push({
          date: sessionISO,
          workout_type: workoutType,
          exercise: ex.exerciseName,
          set_num: i + 1,
          weight_kg: toNum(st.weight_kg),
          reps: toNum(st.reps),
          rpe: toNum(st.rpe),
          notes: st.notes || '',
        })
      })
    }
    if (!flat.length) {
      setResult({ ok: false, error: 'No sets logged yet — tap "Log" on at least one set first.' })
      setFinishing(false)
      return
    }
    try {
      const r = await saveSessionBatch(flat)
      setResult({ ...r, total: flat.length })
      try { localStorage.removeItem(storageKey) } catch {}
      refresh()

      for (const o of overrideRecords) {
        recordOverrideOutcome(o.name, o.suggestion, o.weight, o.reps)
      }

      // Trial pain prompt first; then recalibrate; then summary
      if (trialsLogged.length) {
        setTrialPrompt({ exerciseName: trialsLogged[0], queue: trialsLogged.slice(1), pendingFinishRows: flat })
        return
      }
      const recalCandidate = overrideRecords.find(o => shouldPromptRecalibrate(o.name))
      if (recalCandidate) {
        setRecalPrompt({
          exerciseName: recalCandidate.name,
          suggestion: recalCandidate.suggestion,
          actualWeight: recalCandidate.weight,
          pendingFinishRows: flat,
        })
        return
      }
      // Show post-session summary
      setSummary({
        loggedRows: flat,
        durationSec: Math.floor(elapsedMs(startedAt, Date.now(), pause) / 1000),
      })
    } catch (e) {
      setResult({ ok: false, error: e.message })
    } finally {
      setFinishing(false)
    }
  }

  const handleTrialDone = () => {
    const remaining = trialPrompt?.queue || []
    const flat = trialPrompt?.pendingFinishRows
    if (remaining.length) {
      setTrialPrompt({ exerciseName: remaining[0], queue: remaining.slice(1), pendingFinishRows: flat })
      return
    }
    setTrialPrompt(null)
    // Continue to recalibrate / summary
    setSummary({
      loggedRows: flat || [],
      durationSec: Math.floor(elapsedMs(startedAt, Date.now(), pause) / 1000),
    })
  }

  const handleRecalDone = () => {
    const flat = recalPrompt?.pendingFinishRows
    setRecalPrompt(null)
    setSummary({
      loggedRows: flat || [],
      durationSec: Math.floor(elapsedMs(startedAt, Date.now(), pause) / 1000),
    })
  }

  const handleSummaryDone = () => {
    setSummary(null)
    endGuidedSession()
  }

  // Save & Continue Later — commits logged sets to the sheet for
  // durability, freezes the workout clock, leaves localStorage intact so
  // the session is resumable from the calendar.
  const [pausing, setPausing] = useState(false)
  const handleSaveAndContinue = async () => {
    setPausing(true)
    setResult(null)

    // Engage the timer pause if not already paused, so the clock freezes
    // while the user is away.
    const newPause = pause.pausedAtMs == null
      ? { pausedAtMs: Date.now(), accumPauseMs: pause.accumPauseMs }
      : pause
    setPause(newPause)
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ state, currentIdx, startedAt, pause: newPause })
      )
    } catch {}

    // Commit any logged sets to the sheet so they survive iOS evicting
    // localStorage while the user is away.
    const flat = []
    for (const ex of state) {
      ex.sets.forEach((st, i) => {
        if (!st.logged) return
        flat.push({
          date: sessionISO,
          workout_type: workoutType,
          exercise: ex.exerciseName,
          set_num: i + 1,
          weight_kg: toNum(st.weight_kg),
          reps: toNum(st.reps),
          rpe: toNum(st.rpe),
          notes: st.notes || '',
        })
      })
    }

    if (flat.length) {
      try {
        await saveSessionBatch(flat)
        refresh()
      } catch (e) {
        setResult({ ok: false, error: 'Couldn\'t commit to sheet: ' + e.message + ' — your progress is safe locally though.' })
        setPausing(false)
        return
      }
    }

    setPausing(false)
    endGuidedSession()
  }

  const fmt = date.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-bg-1 border-b border-bg-3 flex-shrink-0">
        <button
          onClick={endGuidedSession}
          className="p-1 -ml-1 text-txt-secondary hover:text-white"
          aria-label="Exit session"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-txt-muted uppercase tracking-wider">{fmt}</div>
          <div className="text-white font-bold text-sm truncate">{titleFor(workoutType)}</div>
        </div>
        <button
          onClick={togglePause}
          className={`p-1.5 rounded-full transition-colors ${
            isPaused ? 'bg-warn/20 text-warn' : 'text-txt-secondary hover:text-white'
          }`}
          aria-label={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <WorkoutClock startedAt={startedAt} pause={pause} />
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-bg-2 flex-shrink-0">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${totalPlanned ? (totalLogged / totalPlanned) * 100 : 0}%` }}
        />
      </div>

      {/* Exercise pager */}
      <div className="flex items-center justify-between px-3 py-2 bg-bg-1/60 border-b border-bg-3 flex-shrink-0">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="p-1.5 text-txt-secondary disabled:opacity-30 hover:text-white"
          aria-label="Previous exercise"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent-light">
            {current.group}
          </div>
          <div className="text-[11px] text-txt-muted">
            Exercise {currentIdx + 1} of {state.length}
          </div>
        </div>
        <button
          onClick={goNext}
          disabled={isLast}
          className="p-1.5 text-txt-secondary disabled:opacity-30 hover:text-white"
          aria-label="Next exercise"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="bg-bg-1 border border-bg-3 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            {(() => {
              const exDef = exercises.find(e => e.name === current.exerciseName)
              const trial = getTrialStatus(phase, current.exerciseName)
              if (exDef?.trial && (!trial || trial.status === 'pending')) {
                return <span className="bg-warn/15 border border-warn/40 text-warn px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Trial</span>
              }
              if (trial?.status === 'cleared') {
                return <span className="bg-success/15 border border-success/40 text-success px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Cleared</span>
              }
              return null
            })()}
          </div>
          <h2 className="text-white font-bold text-lg leading-tight">{current.exerciseName}</h2>
          <div className="text-[12px] text-txt-secondary mt-1 tabular-nums">
            Target: {current.target.sets}×{current.target.reps || '—'}
            {current.target.weight ? ` @ ${current.target.weight}kg` : ''}
          </div>
          {lastByExercise[current.exerciseName]?.length > 0 && (
            <div className="text-[11px] text-txt-muted mt-0.5">
              Last: {lastByExercise[current.exerciseName]
                .slice(0, 4)
                .map(r => `${fmtNum(r.weight_kg)}×${fmtNum(r.reps)}`)
                .join(' · ')}
            </div>
          )}
          {current.note && (
            <div className="text-[12px] text-accent-light italic bg-accent/5 border border-accent/20 rounded-md px-3 py-2 mt-3 leading-snug">
              {current.note}
            </div>
          )}

          {/* Suggestion */}
          {suggestions[current.exerciseName] && !isSuggestionDismissed(current.exerciseName) && (
            <div className={`flex items-start gap-1.5 mt-3 px-3 py-2 rounded-md border ${
              suggestions[current.exerciseName].plateau
                ? 'bg-warn/5 border-warn/30 text-warn'
                : 'bg-accent/5 border-accent/30 text-accent-light'
            }`}>
              {suggestions[current.exerciseName].plateau ? <TrendingUp size={12} className="mt-0.5" /> : <Sparkles size={12} className="mt-0.5" />}
              <div className="flex-1 text-[12px] leading-snug">
                <span className="font-bold">Next session:</span> {suggestions[current.exerciseName].headline}
              </div>
              <button
                onClick={() => { dismissSuggestion(current.exerciseName); forceTick(n => n + 1) }}
                className="text-txt-muted hover:text-white -mr-1 -mt-0.5"
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          )}
          {suggestions[current.exerciseName] && isSuggestionDismissed(current.exerciseName) && (
            <button
              onClick={() => { undismissSuggestion(current.exerciseName); forceTick(n => n + 1) }}
              className="text-[10px] text-txt-muted hover:text-accent-light mt-2 underline"
            >
              Show suggestion
            </button>
          )}
        </div>

        <div className="space-y-2">
          {current.sets.map((st, i) => (
            <SetCard
              key={i}
              num={i + 1}
              row={st}
              onChange={(field, val) => updateSet(i, { [field]: val })}
              onLog={() => logSet(i)}
              onUnlog={() => unlogSet(i)}
              onRemove={current.sets.length > 1 ? () => removeSet(i) : null}
            />
          ))}

          <button
            onClick={addSet}
            className="w-full text-[12px] text-txt-secondary hover:text-white border border-dashed border-bg-3 hover:border-accent/60 rounded-md py-2 flex items-center justify-center gap-1"
          >
            <Plus size={13} /> Add set
          </button>
        </div>

        {result?.ok && (
          <div className="flex items-start gap-2 bg-success/10 border border-success/30 rounded-lg px-3 py-2.5 text-success text-sm">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
            <div>Session saved. {result.total} sets committed.</div>
          </div>
        )}
        {result && result.ok === false && (
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg px-3 py-2.5 text-danger text-sm">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span className="break-all">{result.error}</span>
          </div>
        )}

        <div className="h-20" />
      </div>

      {/* Sticky footer */}
      <div className="flex-shrink-0 px-3 py-3 bg-bg-1 border-t border-bg-3 space-y-2">
        {totalLogged > 0 && (
          <button
            onClick={handleSaveAndContinue}
            disabled={pausing || finishing}
            className="w-full bg-warn/10 hover:bg-warn/20 disabled:opacity-40 text-warn font-semibold rounded-lg py-2 flex items-center justify-center gap-2 border border-warn/30 text-[13px]"
          >
            {pausing ? (
              <><Loader2 size={14} className="animate-spin" /> Saving progress…</>
            ) : (
              <><BookmarkCheck size={14} /> Save & continue later ({totalLogged} sets)</>
            )}
          </button>
        )}

        <div className="flex gap-2">
          {allLoggedOnCurrent && !isLast ? (
            <button
              onClick={goNext}
              className="flex-1 bg-accent hover:bg-accent-dark text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2"
            >
              Next Exercise <ChevronRight size={18} />
            </button>
          ) : isLast ? (
            <button
              onClick={handleFinish}
              disabled={finishing || totalLogged === 0}
              className="flex-1 bg-success hover:opacity-90 disabled:opacity-40 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 shadow-lg shadow-success/20"
            >
              {finishing ? (
                <><Loader2 size={18} className="animate-spin" /> Saving…</>
              ) : (
                <><Flag size={18} /> Finish & Save ({totalLogged})</>
              )}
            </button>
          ) : (
            <button
              onClick={goNext}
              className="flex-1 bg-bg-2 hover:bg-bg-3 text-txt-secondary font-semibold rounded-xl py-3 flex items-center justify-center gap-2 border border-bg-3"
            >
              Skip to Next <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>

      {rest && (
        <RestTimerOverlay
          key={rest.startedAt}
          duration={rest.duration}
          startedAt={rest.startedAt}
          sessionPaused={isPaused}
          onTogglePause={togglePause}
          onDone={() => setRest(null)}
          onSkip={() => setRest(null)}
        />
      )}

      {trialPrompt && (
        <TrialPainPrompt
          exerciseName={trialPrompt.exerciseName}
          phase={phase}
          onDone={handleTrialDone}
        />
      )}
      {recalPrompt && (
        <RecalibratePrompt
          exerciseName={recalPrompt.exerciseName}
          suggestion={recalPrompt.suggestion}
          actualWeight={recalPrompt.actualWeight}
          onDone={handleRecalDone}
        />
      )}
      {summary && (
        <PostSessionSummary
          workoutType={workoutType}
          loggedRows={summary.loggedRows}
          rows={[...rows, ...summary.loggedRows]}
          exercises={exercises}
          durationSec={summary.durationSec}
          onDone={handleSummaryDone}
        />
      )}
    </div>
  )
}

// ─── Trial pain prompt ─────────────────────────────────────────

function TrialPainPrompt({ exerciseName, phase, onDone }) {
  const handle = (answer) => {
    if (answer === 'no') setTrialStatus(phase, exerciseName, 'cleared')
    else setTrialStatus(phase, exerciseName, 'removed')
    onDone()
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-bg-1 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-bg-3 p-5">
        <div className="text-[10px] uppercase tracking-widest text-warn font-bold mb-1">Trial Exercise</div>
        <h3 className="text-white font-bold text-base mb-1">{exerciseName}</h3>
        <p className="text-txt-secondary text-sm leading-snug">
          Did this provoke pain at your focal site (right tibia / shin)?
        </p>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <button onClick={() => handle('yes')} className="bg-danger/15 border border-danger/40 text-danger font-semibold rounded-lg py-2.5 text-sm">Yes</button>
          <button onClick={() => handle('mild')} className="bg-warn/15 border border-warn/40 text-warn font-semibold rounded-lg py-2.5 text-sm">Mild</button>
          <button onClick={() => handle('no')} className="bg-success/15 border border-success/40 text-success font-semibold rounded-lg py-2.5 text-sm">No</button>
        </div>
        <p className="text-[11px] text-txt-muted mt-3 leading-snug">
          Yes / Mild → exercise removed from the program for the rest of the recovery phase.
          No → marked Cleared.
        </p>
      </div>
    </div>
  )
}

// ─── Recalibrate prompt ────────────────────────────────────────

function RecalibratePrompt({ exerciseName, suggestion, actualWeight, onDone }) {
  const [weight, setWeight] = useState(String(actualWeight || suggestion?.weight || ''))
  const submit = () => {
    const w = Number(weight)
    if (!Number.isNaN(w) && w > 0) setRecalibratedWeight(exerciseName, w)
    onDone()
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-bg-1 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-bg-3 p-5">
        <div className="text-[10px] uppercase tracking-widest text-accent-light font-bold mb-1">Recalibrate</div>
        <h3 className="text-white font-bold text-base mb-1">{exerciseName}</h3>
        <p className="text-txt-secondary text-sm leading-snug">
          You've overridden the suggestion 3 sessions in a row. Set a new baseline weight?
        </p>
        <div className="mt-4">
          <label className="block text-[11px] text-txt-muted uppercase tracking-wider mb-1">Baseline weight (kg)</label>
          <input
            type="text"
            inputMode="decimal"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            className="w-full bg-bg-2 text-white text-base rounded-lg px-3 py-2.5 border border-bg-3 focus:border-accent focus:outline-none tabular-nums"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={onDone} className="bg-bg-2 border border-bg-3 text-txt-secondary font-semibold rounded-lg py-2.5 text-sm">Skip</button>
          <button onClick={submit} className="bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg py-2.5 text-sm">Set baseline</button>
        </div>
      </div>
    </div>
  )
}

// ─── Top-right running workout clock ───────────────────────────

function WorkoutClock({ startedAt, pause }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const elapsedSec = Math.max(0, Math.floor(elapsedMs(startedAt, now, pause) / 1000))
  const paused = pause?.pausedAtMs != null
  return (
    <div className={`flex items-center gap-1.5 border rounded-full px-2.5 py-1 ${
      paused ? 'bg-warn/10 border-warn/30' : 'bg-bg-2 border-bg-3'
    }`}>
      <Timer size={12} className={paused ? 'text-warn' : 'text-accent-light'} />
      <span className={`text-[12px] font-bold tabular-nums whitespace-nowrap ${paused ? 'text-warn' : 'text-white'}`}>
        {formatClock(elapsedSec)}
      </span>
    </div>
  )
}

// ─── Set card ──────────────────────────────────────────────────

function SetCard({ num, row, onChange, onLog, onUnlog, onRemove }) {
  const canLog = !row.logged && (!isBlank(row.weight_kg) || !isBlank(row.reps))

  return (
    <div className={`rounded-xl border overflow-hidden ${
      row.logged
        ? 'bg-success/10 border-success/40'
        : 'bg-bg-1 border-bg-3'
    }`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
          row.logged ? 'bg-success text-white' : 'bg-bg-2 text-txt-secondary'
        }`}>
          {row.logged ? <Check size={13} /> : num}
        </div>
        <div className="grid grid-cols-[1fr_1fr_54px] gap-1.5 flex-1">
          <NumInput
            value={row.weight_kg} placeholder="kg"
            onChange={v => onChange('weight_kg', v)}
            disabled={row.logged}
          />
          <NumInput
            value={row.reps} placeholder="reps"
            onChange={v => onChange('reps', v)}
            disabled={row.logged}
          />
          <NumInput
            value={row.rpe} placeholder="RPE"
            onChange={v => onChange('rpe', v)}
            disabled={row.logged}
          />
        </div>
        {row.logged ? (
          <button
            onClick={onUnlog}
            className="px-2 py-1 text-[11px] text-white/70 hover:text-white"
            aria-label="Undo log"
          >
            Undo
          </button>
        ) : (
          <button
            onClick={onLog}
            disabled={!canLog}
            className="px-3 py-1.5 bg-accent hover:bg-accent-dark disabled:opacity-30 text-white text-[11px] font-bold rounded-md"
          >
            Log
          </button>
        )}
        {onRemove && !row.logged && (
          <button
            onClick={onRemove}
            className="p-1 text-txt-muted hover:text-danger"
            aria-label="Remove set"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

function NumInput({ value, onChange, placeholder, disabled }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`text-sm rounded-md px-2 py-1.5 border text-center tabular-nums focus:outline-none w-full ${
        disabled
          ? 'bg-transparent text-white border-transparent font-semibold'
          : 'bg-bg-2 text-white border-bg-3 focus:border-accent'
      }`}
    />
  )
}

// ─── Rest timer overlay + beep ────────────────────────────────

function RestTimerOverlay({ duration, startedAt, sessionPaused, onTogglePause, onDone, onSkip }) {
  // The rest timer maintains its own pause accumulation so a session pause
  // mid-rest doesn't drain the rest countdown. The session pause button is
  // also reflected here as the visible Pause/Resume control.
  const [restPause, setRestPause] = useState({ pausedAtMs: null, accumPauseMs: 0 })
  const [remaining, setRemaining] = useState(duration)
  const beepedRef = useRef(false)
  const prevSessionPaused = useRef(sessionPaused)

  // Mirror session pause state into rest pause — toggling either pauses both.
  useEffect(() => {
    if (sessionPaused === prevSessionPaused.current) return
    prevSessionPaused.current = sessionPaused
    setRestPause(p => {
      if (sessionPaused && p.pausedAtMs == null) return { ...p, pausedAtMs: Date.now() }
      if (!sessionPaused && p.pausedAtMs != null) {
        return { pausedAtMs: null, accumPauseMs: p.accumPauseMs + (Date.now() - p.pausedAtMs) }
      }
      return p
    })
  }, [sessionPaused])

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = elapsedMs(startedAt, Date.now(), restPause) / 1000
      const left = Math.max(0, duration - elapsed)
      setRemaining(Math.ceil(left))
      if (left <= 0 && !restPause.pausedAtMs) {
        clearInterval(id)
        if (!beepedRef.current) {
          beepedRef.current = true
          playRestEndBeep()
        }
        onDone()
      }
    }, 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restPause, duration, startedAt])

  const isPaused = restPause.pausedAtMs != null
  const pct = Math.max(0, remaining) / duration
  const isCritical = remaining <= 10 && !isPaused
  const r = 56
  const c = 2 * Math.PI * r
  const dashoffset = c * (1 - pct)
  const color = isPaused ? '#FF9F0A' : (isCritical ? '#FF453A' : '#4F86F7')

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const fmt = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`

  return (
    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="flex flex-col items-center">
        <div className="text-[11px] uppercase tracking-widest text-txt-muted mb-3">
          {isPaused ? 'Paused' : 'Rest'}
        </div>
        <div className="relative">
          <svg width="160" height="160" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r={r} stroke="#272727" strokeWidth="6" fill="none" />
            <circle
              cx="80" cy="80" r={r}
              stroke={color} strokeWidth="6" fill="none"
              strokeDasharray={c}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
              transform="rotate(-90 80 80)"
              style={{ transition: 'stroke-dashoffset 250ms linear, stroke 200ms' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold tabular-nums" style={{ color }}>{fmt}</span>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={onTogglePause}
            className={`px-5 py-2.5 text-sm font-semibold rounded-full border flex items-center gap-2 ${
              isPaused
                ? 'bg-warn/15 border-warn/40 text-warn'
                : 'bg-bg-2 hover:bg-bg-3 border-bg-3 text-white'
            }`}
          >
            {isPaused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
          </button>
          <button
            onClick={onSkip}
            className="px-5 py-2.5 bg-bg-2 hover:bg-bg-3 text-white text-sm font-semibold rounded-full border border-bg-3 flex items-center gap-2"
          >
            <SkipForward size={14} /> Skip
          </button>
        </div>
      </div>
    </div>
  )
}

// Reuse one AudioContext per page so we don't leak on every rest end.
let sharedAudioCtx = null
function getAudioCtx() {
  if (sharedAudioCtx) return sharedAudioCtx
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    sharedAudioCtx = new AC()
  } catch { return null }
  return sharedAudioCtx
}

function playRestEndBeep() {
  const ctx = getAudioCtx()
  if (!ctx) return
  // iOS: may be suspended until user gesture. Tapping "Log" already counts as one.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  // Triple rising beep: pleasant, unmistakable.
  const beep = (t, freq) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = freq
    osc.type = 'sine'
    const start = ctx.currentTime + t
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22)
    osc.start(start); osc.stop(start + 0.25)
  }
  beep(0.00, 660)
  beep(0.22, 880)
  beep(0.44, 1100)
  // Also vibrate on devices that support it (Android; no-op on iOS).
  try { navigator.vibrate?.([120, 60, 120]) } catch {}
}

// ─── Screen Wake Lock ──────────────────────────────────────────

function useWakeLock(active) {
  const lockRef = useRef(null)
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let cancelled = false

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) { lock.release().catch(() => {}); return }
        lockRef.current = lock
        lock.addEventListener('release', () => {
          // System can drop the lock when tab is hidden; we'll re-acquire on focus.
          lockRef.current = null
        })
      } catch {
        // Unsupported / denied — silently no-op.
      }
    }

    acquire()

    const onVis = () => {
      if (document.visibilityState === 'visible' && !lockRef.current) acquire()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      if (lockRef.current) {
        lockRef.current.release().catch(() => {})
        lockRef.current = null
      }
    }
  }, [active])
}

// ─── Helpers ──────────────────────────────────────────────────

function loadOrBuild(storageKey, exercises, lastByExercise) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.state && Array.isArray(parsed.state)) {
        return {
          state: parsed.state,
          currentIdx: parsed.currentIdx || 0,
          startedAt: parsed.startedAt || Date.now(),
          pause: parsed.pause || { pausedAtMs: null, accumPauseMs: 0 },
        }
      }
    }
  } catch {}
  return {
    state: buildFresh(exercises, lastByExercise),
    currentIdx: 0,
    startedAt: Date.now(),
    pause: { pausedAtMs: null, accumPauseMs: 0 },
  }
}

/** Pause-aware elapsed milliseconds since startedAt. While paused (pausedAtMs
 *  is set), the result is constant. Constant-derivation explained inline. */
function elapsedMs(startedAt, now, pause) {
  const accum = pause?.accumPauseMs || 0
  const live = pause?.pausedAtMs ? (now - pause.pausedAtMs) : 0
  return Math.max(0, now - startedAt - accum - live)
}

function buildFresh(exercises, lastByExercise) {
  return exercises.map(ex => {
    const last = lastByExercise[ex.name] || []
    const sets = []
    for (let i = 0; i < ex.sets; i++) {
      const l = last[i]
      sets.push({
        weight_kg: l ? String(l.weight_kg ?? ex.weight) : String(ex.weight || ''),
        reps: l ? String(l.reps ?? ex.reps) : String(ex.reps || ''),
        rpe: '',
        notes: '',
        logged: false,
      })
    }
    return {
      exerciseName: ex.name,
      group: ex.group,
      note: ex.note,
      target: { sets: ex.sets, reps: ex.reps, weight: ex.weight },
      sets,
    }
  })
}

function restDurationFor(group) {
  return /superset/i.test(group) ? REST_SUPERSET : REST_MAIN
}

function formatClock(totalSec) {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function isBlank(v) { return v == null || v === '' }
function toNum(v) {
  if (isBlank(v)) return ''
  const n = Number(v)
  return Number.isNaN(n) ? v : n
}
function fmtNum(v) {
  if (isBlank(v)) return '—'
  const n = Number(v)
  return Number.isNaN(n) ? String(v) : String(n)
}
function isoToDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
