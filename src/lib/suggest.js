// src/lib/suggest.js
// Per-exercise progression suggestion engine. Pulls last 3 sessions of an
// exercise from the deduped sheet rows and applies a category-specific rule
// to suggest the next session's target.
//
// Rules (per user spec):
//   main         → +2.5kg if all clean & RPE ≤8; repeat if RPE ≥9; same if
//                  missed; -5kg deload after 2 consecutive misses.
//   weighted-bw  → same as main, +2.5kg increments.
//   accessory    → +1kg if hit top of range; same + push for an extra rep
//                  otherwise.
//   rehab        → +1kg max, only if clean.
//   amrap        → "beat last total reps by 1+".
//   time         → "beat last seconds by 5+".
//
// Plateau: ≥3 sessions at the same top weight & top reps → flag and suggest
// either a deload or a technique-focus session.
//
// User-recalibrated weights override program defaults (set via the
// recalibrate prompt after 3 consecutive overrides).

import { toISODate, getSettings } from './settings'

const N_LOOKBACK = 3

export function suggestNext(exercise, rows) {
  const sessions = lastNSessions(rows, exercise.name, N_LOOKBACK)
  const recal = getSettings().recalibratedWeights[exercise.name]
  const baseWeight = recal?.weight ?? exercise.weight ?? 0

  if (!sessions.length) {
    // No history yet — anchor on program target (or recalibrated baseline).
    return msg({
      exercise,
      weight: baseWeight,
      reps: exercise.reps,
      reason: 'No history — start at program target.',
      headline: cold(exercise, baseWeight),
      coldStart: true,
    })
  }

  const last = sessions[sessions.length - 1]
  const lastTopWeight = topWeight(last.sets)
  const lastTopReps = topReps(last.sets)
  const allCleanLast = sessionClean(last.sets, exercise.reps)
  const lastAvgRpe = avgRpe(last.sets)

  // Plateau when the most recent N≥3 sessions share top weight + top reps.
  const plateau = sessions.length >= 3 &&
    sessions.every(s =>
      topWeight(s.sets) === lastTopWeight &&
      topReps(s.sets) === lastTopReps
    )

  switch (exercise.category) {
    case 'main':
    case 'weighted-bw':
      return suggestMain(exercise, sessions, last, allCleanLast, lastAvgRpe, lastTopWeight, plateau)
    case 'rehab':
      return suggestRehab(exercise, last, lastTopWeight, allCleanLast, plateau)
    case 'amrap':
      return suggestAmrap(exercise, last, lastTopReps, plateau)
    case 'time':
      return suggestTime(exercise, last, lastTopReps, plateau)
    case 'accessory':
    default:
      return suggestAccessory(exercise, last, lastTopWeight, lastTopReps, plateau)
  }
}

// ─── Per-category suggestions ──────────────────────────────────

function suggestMain(ex, sessions, last, allClean, avgRpe, topW, plateau) {
  const inc = mainIncrement(ex)

  // Two consecutive misses → deload
  if (sessions.length >= 2) {
    const prev = sessions[sessions.length - 2]
    if (!sessionClean(prev.sets, ex.reps) && !allClean) {
      const deload = round2_5(topW - 5)
      return msg({
        exercise: ex,
        weight: deload,
        reps: ex.reps,
        reason: 'Two sessions in a row missed reps — deload.',
        headline: `${deload}kg × ${ex.sets}×${ex.reps} (deload, -5kg)`,
        plateau,
      })
    }
  }

  if (plateau) {
    return msg({
      exercise: ex,
      weight: topW,
      reps: ex.reps,
      reason: '3+ sessions at the same top weight. Try a deload week or focus on bar speed.',
      headline: `${topW}kg × ${ex.sets}×${ex.reps} (plateau — consider deload or technique work)`,
      plateau: true,
    })
  }

  if (allClean && avgRpe > 0 && avgRpe <= 8) {
    const next = round2_5(topW + inc)
    return msg({
      exercise: ex,
      weight: next,
      reps: ex.reps,
      reason: `All sets clean at RPE ${fmt(avgRpe)} — progress.`,
      headline: `${next}kg × ${ex.sets}×${ex.reps} (+${inc}kg from last)`,
    })
  }

  if (allClean && avgRpe >= 9) {
    return msg({
      exercise: ex,
      weight: topW,
      reps: ex.reps,
      reason: `Hit reps but RPE ${fmt(avgRpe)} — repeat to consolidate.`,
      headline: `${topW}kg × ${ex.sets}×${ex.reps} (repeat — RPE ≥9)`,
    })
  }

  if (allClean) {
    // No RPE recorded but reps clean — small bump.
    const next = round2_5(topW + inc)
    return msg({
      exercise: ex,
      weight: next,
      reps: ex.reps,
      reason: 'All sets at target reps (no RPE) — assume +1 increment.',
      headline: `${next}kg × ${ex.sets}×${ex.reps} (+${inc}kg from last)`,
    })
  }

  return msg({
    exercise: ex,
    weight: topW,
    reps: ex.reps,
    reason: 'Missed reps last session — repeat the weight.',
    headline: `${topW}kg × ${ex.sets}×${ex.reps} (repeat — missed last)`,
  })
}

function suggestAccessory(ex, last, topW, topR, plateau) {
  if (plateau) {
    return msg({
      exercise: ex,
      weight: topW,
      reps: ex.reps,
      reason: '3+ sessions identical — try +1kg with focus on form.',
      headline: `${topW + 1}kg × ${ex.sets}×${ex.reps} (plateau — small bump)`,
      plateau: true,
    })
  }
  if (topR >= ex.reps) {
    const next = topW + 1
    return msg({
      exercise: ex,
      weight: next,
      reps: ex.reps,
      reason: 'Hit top of rep range last session.',
      headline: `${next}kg × ${ex.sets}×${ex.reps} (+1kg)`,
    })
  }
  return msg({
    exercise: ex,
    weight: topW,
    reps: ex.reps,
    reason: 'Beat last session by a rep before adding weight.',
    headline: `${topW}kg, push for ${topR + 1}+ reps`,
  })
}

function suggestRehab(ex, last, topW, allClean, plateau) {
  if (allClean && !plateau) {
    return msg({
      exercise: ex,
      weight: topW + 1,
      reps: ex.reps,
      reason: 'Clean rehab session — micro bump.',
      headline: `${topW + 1}kg × ${ex.sets}×${ex.reps} (+1kg, form-priority)`,
    })
  }
  return msg({
    exercise: ex,
    weight: topW,
    reps: ex.reps,
    reason: 'Hold weight, focus on perfect form.',
    headline: `${topW}kg × ${ex.sets}×${ex.reps} (hold — form first)`,
    plateau,
  })
}

function suggestAmrap(ex, last, topR, plateau) {
  return msg({
    exercise: ex,
    weight: 0,
    reps: topR + 1,
    reason: `Last session: ${topR} max reps. Beat it by 1+.`,
    headline: `Beat ${topR} reps`,
    plateau,
  })
}

function suggestTime(ex, last, topR, plateau) {
  return msg({
    exercise: ex,
    weight: topW(last.sets) || ex.weight,
    reps: topR + 5,
    reason: `Last session: ${topR}s. Beat it by 5+.`,
    headline: `Beat ${topR}s (+5s)`,
    plateau,
  })
}

function cold(ex, weight) {
  if (ex.category === 'amrap') return `Max reps @ BW`
  if (ex.category === 'time') return `Max time${ex.weight ? ` @ ${weight}kg` : ''}`
  return `${weight}kg × ${ex.sets}×${ex.reps}`
}

// ─── Helpers ───────────────────────────────────────────────────

function lastNSessions(rows, exerciseName, n) {
  const matches = (rows || []).filter(r => r.exercise === exerciseName && r.date)
  if (!matches.length) return []
  const byDate = {}
  for (const r of matches) {
    const iso = toISODate(new Date(r.date))
    if (!byDate[iso]) byDate[iso] = []
    byDate[iso].push(r)
  }
  const isos = Object.keys(byDate).sort()
  return isos.slice(-n).map(iso => ({
    iso,
    sets: byDate[iso].sort((a, b) => (Number(a.set_num) || 0) - (Number(b.set_num) || 0)),
  }))
}

function topWeight(sets) {
  let m = 0
  for (const s of sets) {
    const w = Number(s.weight_kg) || 0
    if (w > m) m = w
  }
  return m
}
const topW = topWeight

function topReps(sets) {
  let m = 0
  for (const s of sets) {
    const r = Number(s.reps) || 0
    if (r > m) m = r
  }
  return m
}

function avgRpe(sets) {
  const vals = sets
    .map(s => Number(s.rpe))
    .filter(v => !Number.isNaN(v) && v > 0)
  if (!vals.length) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function sessionClean(sets, targetReps) {
  if (!sets.length) return false
  return sets.every(s => (Number(s.reps) || 0) >= targetReps)
}

function mainIncrement(ex) {
  // RDL specifically gets +5kg; other mains get +2.5.
  if (/deadlift|RDL/i.test(ex.name)) return 5
  return 2.5
}

function round2_5(x) {
  return Math.round(x * 2) / 2
}

function fmt(n) {
  if (!n) return '0'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function msg({ exercise, weight, reps, reason, headline, plateau = false, coldStart = false }) {
  return {
    exerciseName: exercise.name,
    weight,
    reps,
    headline,
    reason,
    plateau,
    coldStart,
    category: exercise.category,
  }
}
