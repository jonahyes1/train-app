// src/lib/program.js
// Workout catalog. Two phases coexist:
//   - "original": the baseline 4-day split.
//   - "until-recovery": a temporary upper-body-only program for the duration
//     of a tibial stress reaction. Lives alongside the original — switching
//     phases never deletes data.
//
// Exercise NAMES are the implicit join key for progression history. If a
// recovery exercise reuses an exact name from the original program (e.g.
// "Bench Press"), the Progress charts and last-session prefill auto-share
// data. New names start a fresh history.
//
// Each exercise carries a `category` that drives the suggestion engine:
//   'main'        — barbell/DB compound; +2.5kg when clean at RPE ≤8
//   'weighted-bw' — weighted bodyweight (pull-ups, chin-ups); +2.5kg
//   'accessory'   — higher-rep iso/secondary; +1kg when top of range hit
//   'rehab'       — form-priority; +1kg max, only if previous was clean
//   'amrap'       — bodyweight max-rep (AMRAP, push-ups); beat last + 1
//   'time'        — time-hold (planks, hangs, balance); beat last + 5s
//
// `muscleGroup` drives the Progress tab's per-group navigation. Values:
//   Chest, Back, Shoulders, Biceps, Triceps, Forearms, Legs,
//   Calves/Shins, Core, Conditioning.
//
// `trial: true` flags a movement as "verify no pain on first log" — see
// trialStatus in settings.js for state. `unit` is for time-based moves.

export const WORKOUT_TYPES_ORIGINAL = ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Rest']
export const WORKOUT_TYPES_RECOVERY = [
  'Upper A - Until Recovery',
  'Recovery + Core A - Until Recovery',
  'Upper B - Until Recovery',
  'Recovery + Core B - Until Recovery',
  'Rest',
]
// Backwards compatibility — legacy code imports WORKOUT_TYPES.
export const WORKOUT_TYPES = [
  ...WORKOUT_TYPES_ORIGINAL.filter(t => t !== 'Rest'),
  ...WORKOUT_TYPES_RECOVERY.filter(t => t !== 'Rest'),
  'Rest',
]

export const PROGRAM = {
  // ─── ORIGINAL PHASE ────────────────────────────────────────────

  'Upper A': {
    title: 'Upper A — Chest + Back',
    duration: '~55 min',
    phase: 'original',
    exercises: [
      { name: 'Bench Press', sets: 4, reps: 5, weight: 72.5, group: 'Main', category: 'main', muscleGroup: 'Chest', note: '2s pause on set 1. Add 2.5kg when all sets clean.' },
      { name: 'Weighted Pull-Ups', sets: 4, reps: 5, weight: 5, group: 'Main', category: 'weighted-bw', muscleGroup: 'Back', note: '+5kg belt or DB between feet.' },
      { name: 'Incline DB Press', sets: 3, reps: 10, weight: 20, group: 'Superset A', category: 'accessory', muscleGroup: 'Chest', note: '3s eccentric, full stretch at bottom.' },
      { name: 'Chest-Supported DB Row', sets: 3, reps: 10, weight: 25, group: 'Superset A', category: 'accessory', muscleGroup: 'Back', note: '1s squeeze, wrist neutral.' },
      { name: 'DB Lateral Raise', sets: 3, reps: 14, weight: 7, group: 'Superset B', category: 'accessory', muscleGroup: 'Shoulders', note: 'Pinky up, no momentum.' },
      { name: 'Cable Face Pull', sets: 3, reps: 14, weight: 30, group: 'Superset B', category: 'accessory', muscleGroup: 'Shoulders', note: 'Elbows high, pull to forehead.' },
      { name: 'Reverse Curls', sets: 3, reps: 12, weight: 15, group: 'Superset C — Wrist Rehab', category: 'rehab', muscleGroup: 'Forearms', note: 'EZ bar, slow eccentric.' },
      { name: 'Wrist Curls', sets: 3, reps: 15, weight: 7.5, group: 'Superset C — Wrist Rehab', category: 'rehab', muscleGroup: 'Forearms', note: 'Forearm on bench, palms up.' },
    ],
  },

  'Lower A': {
    title: 'Lower A — Quads Focus',
    duration: '~50 min',
    phase: 'original',
    exercises: [
      { name: 'Back Squat', sets: 4, reps: 7, weight: 70, group: 'Main', category: 'main', muscleGroup: 'Legs', note: 'Add 2.5kg when top set hits 8 clean.' },
      { name: 'Walking Lunges', sets: 3, reps: 10, weight: 10, group: 'Superset A', category: 'accessory', muscleGroup: 'Legs', note: '10/leg. Replaces Bulgarian split squats.' },
      { name: 'Cable Crunch', sets: 3, reps: 13, weight: 50, group: 'Superset A', category: 'accessory', muscleGroup: 'Core', note: 'Kneel, elbows to knees.' },
      { name: 'Spanish Squat', sets: 3, reps: 13, weight: 10, group: 'Superset B', category: 'accessory', muscleGroup: 'Legs', note: 'Band or cable, knees track toes.' },
      { name: 'Hanging Knee Raise', sets: 3, reps: 11, weight: 0, group: 'Superset B', category: 'accessory', muscleGroup: 'Core', note: 'Bodyweight. Controlled.' },
      { name: 'Calf Raise', sets: 3, reps: 15, weight: 20, group: 'Superset C — Shin Rehab', category: 'accessory', muscleGroup: 'Calves/Shins', note: 'Full ROM, 1s pause at top.' },
      { name: 'Tibialis Raises', sets: 3, reps: 20, weight: 0, group: 'Superset C — Shin Rehab', category: 'rehab', muscleGroup: 'Calves/Shins', note: 'Bodyweight. Overpronation fix.' },
    ],
  },

  'Upper B': {
    title: 'Upper B — Shoulders + Back',
    duration: '~55 min',
    phase: 'original',
    exercises: [
      { name: 'Push Press', sets: 4, reps: 7, weight: 40, group: 'Main', category: 'main', muscleGroup: 'Shoulders', note: 'Standing BB. Replaces seated OHP.' },
      { name: 'Pull-Ups AMRAP', sets: 3, reps: 0, weight: 0, group: 'Main', category: 'amrap', muscleGroup: 'Back', note: 'Bodyweight max reps. Last 2 reps = 5s slow negative.' },
      { name: 'Chest-Supported DB Row', sets: 4, reps: 9, weight: 30, group: 'Superset A', category: 'accessory', muscleGroup: 'Back', note: 'Heavier than Upper A.' },
      { name: 'Archer Push-Ups', sets: 4, reps: 8, weight: 0, group: 'Superset A', category: 'amrap', muscleGroup: 'Chest', note: '8/side. Bodyweight, slow, full reach.' },
      { name: 'Single-Arm Lat Pulldown', sets: 3, reps: 10, weight: 17.5, group: 'Superset B', category: 'accessory', muscleGroup: 'Back', note: '10/side. Full stretch at top.' },
      { name: 'DB Lateral Raise', sets: 3, reps: 13, weight: 7, group: 'Superset B', category: 'accessory', muscleGroup: 'Shoulders', note: 'Slight forward lean.' },
      { name: 'Hammer Curls', sets: 3, reps: 11, weight: 12.5, group: 'Superset C', category: 'accessory', muscleGroup: 'Biceps', note: 'Strict, wrist neutral.' },
      { name: 'Dead Hangs', sets: 3, reps: 0, weight: 0, group: 'Superset C', category: 'time', unit: 'seconds', muscleGroup: 'Forearms', note: 'Max time. Log SECONDS in reps column.' },
    ],
  },

  'Lower B': {
    title: 'Lower B — Glutes + Hamstrings',
    duration: '~50 min',
    phase: 'original',
    exercises: [
      { name: 'Romanian Deadlift', sets: 4, reps: 7, weight: 62.5, group: 'Main', category: 'main', muscleGroup: 'Legs', note: 'Add 5kg when top set hits 8.' },
      { name: 'Barbell Hip Thrust', sets: 3, reps: 11, weight: 60, group: 'Main', category: 'main', muscleGroup: 'Legs', note: 'Full squeeze at top.' },
      { name: 'Walking Lunges', sets: 3, reps: 8, weight: 12.5, group: 'Superset A', category: 'accessory', muscleGroup: 'Legs', note: '8/leg. Glute bias, forward lean.' },
      { name: 'Weighted Plank', sets: 3, reps: 45, weight: 15, group: 'Superset A', category: 'time', unit: 'seconds', muscleGroup: 'Core', note: '15kg plate. Log SECONDS in reps column.' },
      { name: 'Single-Leg Calf Raise', sets: 3, reps: 10, weight: 10, group: 'Superset B', category: 'accessory', muscleGroup: 'Calves/Shins', note: '10/leg. Full ROM.' },
      { name: 'Tibialis Raises', sets: 3, reps: 20, weight: 0, group: 'Superset B', category: 'rehab', muscleGroup: 'Calves/Shins', note: 'Heels on wall.' },
      { name: 'Cable Woodchopper', sets: 3, reps: 12, weight: 20, group: 'Superset C — Stability', category: 'accessory', muscleGroup: 'Core', note: '12/side. Rotational, controlled.' },
      { name: 'Single-Leg Balance', sets: 3, reps: 30, weight: 0, group: 'Superset C — Stability', category: 'time', unit: 'seconds', muscleGroup: 'Conditioning', note: '30s/side. Folded towel. Log SECONDS in reps.' },
    ],
  },

  // ─── UNTIL-RECOVERY PHASE ──────────────────────────────────────

  'Upper A - Until Recovery': {
    title: 'Upper A — Recovery (Chest, Back, Arms)',
    duration: '~60 min',
    phase: 'until-recovery',
    exercises: [
      { name: 'Bench Press', sets: 4, reps: 5, weight: 72.5, group: 'Main', category: 'main', muscleGroup: 'Chest', note: '2s pause on set 1.' },
      { name: 'Weighted Pull-Ups', sets: 4, reps: 5, weight: 5, group: 'Main', category: 'weighted-bw', muscleGroup: 'Back', note: '+5kg belt or DB between feet.' },
      { name: 'Incline DB Press', sets: 4, reps: 8, weight: 20, group: 'Superset A', category: 'accessory', muscleGroup: 'Chest', note: '3s eccentric.' },
      { name: 'Chest-Supported DB Row', sets: 4, reps: 10, weight: 25, group: 'Superset A', category: 'accessory', muscleGroup: 'Back', note: '1s squeeze.' },
      { name: 'DB Flyes', sets: 3, reps: 12, weight: 10, group: 'Superset B', category: 'accessory', muscleGroup: 'Chest', note: 'Full stretch.' },
      { name: 'Single-Arm Lat Pulldown', sets: 3, reps: 10, weight: 17.5, group: 'Superset B', category: 'accessory', muscleGroup: 'Back', note: '10/side. Full stretch top.' },
      { name: 'EZ Bar Curl', sets: 4, reps: 8, weight: 20, group: 'Superset C', category: 'accessory', muscleGroup: 'Biceps', note: 'Strict.' },
      { name: 'Close-Grip Bench Press', sets: 4, reps: 8, weight: 50, group: 'Superset C', category: 'main', muscleGroup: 'Triceps', note: 'Elbows tucked.' },
      { name: 'Reverse Curls', sets: 3, reps: 12, weight: 15, group: 'Superset D — Wrist Rehab', category: 'rehab', muscleGroup: 'Forearms', note: 'EZ bar, slow eccentric.' },
      { name: 'Wrist Curls', sets: 3, reps: 15, weight: 7.5, group: 'Superset D — Wrist Rehab', category: 'rehab', muscleGroup: 'Forearms', note: 'Forearm on bench, palms up.' },
    ],
  },

  'Recovery + Core A - Until Recovery': {
    title: 'Recovery + Core A — Back, Arms, Core',
    duration: '~55 min',
    phase: 'until-recovery',
    exercises: [
      { name: 'Seated Cable Row (Heavy)', sets: 4, reps: 8, weight: 50, group: 'Main', category: 'main', muscleGroup: 'Back', note: '+2.5kg when clean.' },
      { name: 'Lat Pulldown (Heavy)', sets: 4, reps: 8, weight: 50, group: 'Main', category: 'main', muscleGroup: 'Back', note: '+2.5kg when clean.' },
      { name: 'Hammer Curls', sets: 4, reps: 10, weight: 12.5, group: 'Superset A', category: 'accessory', muscleGroup: 'Biceps', note: 'Strict, wrist neutral.' },
      { name: 'Overhead Tricep Extension', sets: 4, reps: 10, weight: 15, group: 'Superset A', category: 'accessory', muscleGroup: 'Triceps', note: 'Full stretch overhead.' },
      { name: 'Reverse Wrist Curls', sets: 3, reps: 15, weight: 5, group: 'Superset B — Forearm', category: 'rehab', muscleGroup: 'Forearms', note: 'Palms down.' },
      { name: 'Plate Pinches', sets: 3, reps: 30, weight: 10, group: 'Superset B — Forearm', category: 'time', unit: 'seconds', muscleGroup: 'Forearms', note: '2x10kg plates pinched. Log SECONDS in reps.' },
      { name: 'Cable Crunch', sets: 3, reps: 13, weight: 50, group: 'Superset C — Core', category: 'accessory', muscleGroup: 'Core', note: 'Kneel, elbows to knees.' },
      { name: 'Pallof Press', sets: 3, reps: 12, weight: 15, group: 'Superset C — Core', category: 'accessory', muscleGroup: 'Core', note: '12/side. Hold tension.' },
      { name: 'Hanging Knee Raise', sets: 3, reps: 11, weight: 0, group: 'Superset D — Core', category: 'accessory', muscleGroup: 'Core', note: 'Bodyweight. Controlled.' },
      { name: 'Lying Leg Curl', sets: 3, reps: 12, weight: 20, group: 'Superset D — Core', category: 'accessory', muscleGroup: 'Legs', trial: true, note: 'TRIAL — stop if focal shin pain. Load is at the cuff, not axial.' },
    ],
  },

  'Upper B - Until Recovery': {
    title: 'Upper B — Recovery (Shoulders, Back, Arms)',
    duration: '~60 min',
    phase: 'until-recovery',
    exercises: [
      { name: 'Seated DB Shoulder Press', sets: 4, reps: 7, weight: 22.5, group: 'Main', category: 'main', muscleGroup: 'Shoulders', note: '+1kg/DB when clean. Replaces Push Press for the recovery phase.' },
      { name: 'Pull-Ups AMRAP', sets: 3, reps: 0, weight: 0, group: 'Main', category: 'amrap', muscleGroup: 'Back', note: 'Bodyweight max reps. Last 2 = 5s slow negative.' },
      { name: 'Chest-Supported DB Row', sets: 4, reps: 9, weight: 30, group: 'Superset A', category: 'accessory', muscleGroup: 'Back', note: 'Heavier.' },
      { name: 'Archer Push-Ups', sets: 4, reps: 8, weight: 0, group: 'Superset A', category: 'amrap', muscleGroup: 'Chest', note: '8/side. Bodyweight, slow.' },
      { name: 'DB Lateral Raise', sets: 4, reps: 12, weight: 7, group: 'Superset B', category: 'accessory', muscleGroup: 'Shoulders', note: 'Pinky up.' },
      { name: 'Cable Face Pull', sets: 4, reps: 14, weight: 30, group: 'Superset B', category: 'accessory', muscleGroup: 'Shoulders', note: 'Elbows high.' },
      { name: 'Incline DB Curl', sets: 4, reps: 10, weight: 10, group: 'Superset C', category: 'accessory', muscleGroup: 'Biceps', note: 'Bench at 60°.' },
      { name: 'DB Skullcrushers', sets: 4, reps: 10, weight: 12.5, group: 'Superset C', category: 'accessory', muscleGroup: 'Triceps', note: 'Full ROM.' },
      { name: 'Hammer Curls', sets: 3, reps: 11, weight: 12.5, group: 'Superset D', category: 'accessory', muscleGroup: 'Biceps', note: 'Strict.' },
      { name: 'Dead Hangs', sets: 3, reps: 0, weight: 0, group: 'Superset D', category: 'time', unit: 'seconds', muscleGroup: 'Forearms', note: 'Max time. Step UP to bar (no jump).' },
    ],
  },

  'Recovery + Core B - Until Recovery': {
    title: 'Recovery + Core B — Push, Pull, Core',
    duration: '~55 min',
    phase: 'until-recovery',
    exercises: [
      { name: 'Incline Bench Press', sets: 4, reps: 6, weight: 55, group: 'Main', category: 'main', muscleGroup: 'Chest', note: '+2.5kg when clean.' },
      { name: 'Weighted Chin-Ups', sets: 4, reps: 6, weight: 2.5, group: 'Main', category: 'weighted-bw', muscleGroup: 'Back', note: '+2.5kg when clean.' },
      { name: 'Cable Crossovers', sets: 4, reps: 12, weight: 15, group: 'Superset A', category: 'accessory', muscleGroup: 'Chest', note: 'High-to-low, squeeze.' },
      { name: 'Push-Ups', sets: 4, reps: 0, weight: 0, group: 'Superset A', category: 'amrap', muscleGroup: 'Chest', note: 'Max reps. Step UP to position (no jumping).' },
      { name: 'Cable Curl', sets: 4, reps: 10, weight: 25, group: 'Superset B', category: 'accessory', muscleGroup: 'Biceps', note: 'Constant tension.' },
      { name: 'Tricep Pushdown', sets: 4, reps: 12, weight: 25, group: 'Superset B', category: 'accessory', muscleGroup: 'Triceps', note: 'Full ROM.' },
      { name: "Farmer's Carry Static Hold", sets: 3, reps: 30, weight: 25, group: 'Superset C — Forearm', category: 'time', unit: 'seconds', muscleGroup: 'Forearms', note: '25kg DBs. Log SECONDS. Hold static — DO NOT walk.' },
      { name: 'Wrist Roller', sets: 3, reps: 2, weight: 5, group: 'Superset C — Forearm', category: 'rehab', muscleGroup: 'Forearms', note: '2 rolls up + down. Or sub Wrist Curls 3×15 @ 7.5kg.' },
      { name: 'Weighted Plank', sets: 3, reps: 45, weight: 15, group: 'Superset D — Core', category: 'time', unit: 'seconds', muscleGroup: 'Core', note: '15kg plate. Log SECONDS.' },
      { name: 'Side Plank', sets: 3, reps: 30, weight: 0, group: 'Superset D — Core', category: 'time', unit: 'seconds', muscleGroup: 'Core', note: '30s/side. Log SECONDS.' },
    ],
  },
}

// ─── Custom content (user-added) ───────────────────────────────
// Custom workouts and extra exercises live in localStorage (settings.js).
// These exports are pure read-side helpers that merge them into the
// in-memory PROGRAM when the UI asks for a workout.

import {
  getCustomWorkouts as _getCustomWorkouts,
  getCustomExercises as _getCustomExercises,
} from './settings'

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Forearms', 'Legs', 'Calves/Shins', 'Core', 'Conditioning',
]
export const MUSCLE_GROUP_LIST = MUSCLE_GROUPS

/** Lookup exercises for a workout_type. Returns [] for Rest / unknown.
 *  Includes user-added custom exercises appended to the end. */
export function exercisesFor(workoutType) {
  const builtin = PROGRAM[workoutType]?.exercises
  const customWorkout = _getCustomWorkouts()[workoutType]?.exercises
  const customExtras = _getCustomExercises()[workoutType] || []
  if (builtin) return [...builtin, ...customExtras]
  if (customWorkout) return [...customWorkout, ...customExtras]
  return []
}

/** Lookup the display title for a workout_type. */
export function titleFor(workoutType) {
  if (PROGRAM[workoutType]) return PROGRAM[workoutType].title
  const cw = _getCustomWorkouts()[workoutType]
  if (cw) return cw.title || workoutType
  return workoutType
}

/** Phase a workout belongs to ('original' | 'until-recovery' | null for Rest). */
export function phaseFor(workoutType) {
  if (PROGRAM[workoutType]) return PROGRAM[workoutType].phase
  const cw = _getCustomWorkouts()[workoutType]
  return cw?.phase || null
}

/** All workout types for a given phase, in display order. Includes custom. */
export function workoutTypesInPhase(phase) {
  const base = phase === 'until-recovery' ? WORKOUT_TYPES_RECOVERY : WORKOUT_TYPES_ORIGINAL
  const customNames = Object.entries(_getCustomWorkouts())
    .filter(([, w]) => (w.phase || 'original') === phase)
    .map(([name]) => name)
  // Insert custom names before "Rest" so Rest stays last
  const withoutRest = base.filter(t => t !== 'Rest')
  return [...withoutRest, ...customNames, 'Rest']
}

/** All distinct workout entries (builtin + custom). For browse views. */
export function allWorkoutEntries() {
  const out = {}
  for (const k of Object.keys(PROGRAM)) out[k] = PROGRAM[k]
  for (const [k, v] of Object.entries(_getCustomWorkouts())) {
    if (!out[k]) out[k] = v
  }
  return out
}

/** Best-guess muscle group for any exercise name. Searches the catalog
 *  + custom exercises first; falls back to keyword heuristics. */
export function muscleGroupFor(exerciseName) {
  if (!exerciseName) return 'Other'

  // 1. Direct catalog lookup (builtin + custom workouts + custom extras)
  for (const wt of Object.keys(PROGRAM)) {
    const found = PROGRAM[wt].exercises.find(e => e.name === exerciseName)
    if (found?.muscleGroup) return found.muscleGroup
  }
  for (const [, wt] of Object.entries(_getCustomWorkouts())) {
    const found = (wt.exercises || []).find(e => e.name === exerciseName)
    if (found?.muscleGroup) return found.muscleGroup
  }
  for (const list of Object.values(_getCustomExercises())) {
    const found = (list || []).find(e => e.name === exerciseName)
    if (found?.muscleGroup) return found.muscleGroup
  }

  // 2. Heuristic fallback for legacy / sheet-only exercises
  const n = exerciseName.toLowerCase()
  if (/(bench|fly|press up|pec|push-up|pushup|push up|chest|incline|decline|crossover)/.test(n)) return 'Chest'
  if (/(pull[- ]?up|chin[- ]?up|row|pulldown|lat |deadlift|hyper)/.test(n)) return 'Back'
  if (/(shoulder|ohp|push press|lateral raise|face pull|overhead press|rear delt)/.test(n)) return 'Shoulders'
  if (/(curl|chin)/.test(n) && !/(reverse|wrist)/.test(n)) return 'Biceps'
  if (/(skullcrusher|tricep|pushdown|close[- ]grip|extension)/.test(n)) return 'Triceps'
  if (/(wrist|forearm|reverse curl|plate pinch|pinch|farmer|hang|wrist roller)/.test(n)) return 'Forearms'
  if (/(squat|lunge|hip thrust|hamstring|leg curl|leg press|glute|deadlift)/.test(n)) return 'Legs'
  if (/(calf|tibial|shin)/.test(n)) return 'Calves/Shins'
  if (/(crunch|plank|knee raise|woodchop|pallof|ab |sit-?up|core|side bend)/.test(n)) return 'Core'
  if (/(carry|sled|sprint|cardio|run|bike|balance)/.test(n)) return 'Conditioning'
  return 'Other'
}
