// src/lib/settings.js
// Local-only app config. Nothing here is committed to the repo.
// Holds phase state, day-of-week → workout_type maps for each phase,
// per-date overrides, phase-change history, trial-status flags, dismissed
// suggestions, and override-streak tracking for the suggestion engine.

const KEY = 'trainapp:settings:v1'
const STATE_VERSION = 4

const ORIGINAL_PATTERN = {
  0: 'Upper A',      // Sun
  1: 'Lower A',      // Mon
  2: 'Rest',         // Tue
  3: 'Upper B',      // Wed
  4: 'Lower B',      // Thu
  5: 'Rest',         // Fri
  6: 'Rest',         // Sat
}

const RECOVERY_PATTERN = {
  0: 'Upper A - Until Recovery',
  1: 'Recovery + Core A - Until Recovery',
  2: 'Rest',
  3: 'Upper B - Until Recovery',
  4: 'Recovery + Core B - Until Recovery',
  5: 'Rest',
  6: 'Rest',
}

const DEFAULTS = {
  appsScriptUrl: '',
  password: '',

  // Phase model
  activePhase: 'original',                  // 'original' | 'until-recovery'
  patterns: {                               // weekday → workout_type, per phase
    original: { ...ORIGINAL_PATTERN },
    'until-recovery': { ...RECOVERY_PATTERN },
  },
  dayOverrides: {},                         // { 'YYYY-MM-DD': workout_type }

  // Phase change audit log
  phaseHistory: [],                         // [{ from, to, isoDate, timestamp }]

  // Trial-flag state per (phase, exerciseName)
  // status: 'pending' | 'cleared' | 'removed'
  trialStatus: {},                          // { [`${phase}::${name}`]: { status, isoDate } }

  // Suggestions UI state
  dismissedSuggestions: {},                 // { [exerciseName]: { isoDate } }

  // Override-streak tracking — when user logs a session that doesn't match
  // the suggestion, increment streak. After 3, surface a recalibrate prompt.
  overrideTracking: {},                     // { [exerciseName]: { streak, lastSuggestion } }

  // User-set baseline weight for suggestions (overrides program defaults)
  recalibratedWeights: {},                  // { [exerciseName]: { weight, isoDate } }

  // User-added workouts and extra exercises
  customWorkouts: {},                       // { [name]: { title, duration, phase, exercises: [...] } }
  customExercises: {},                      // { [workoutType]: [exercise, ...] } — appended to builtin

  stateVersion: STATE_VERSION,
}

// ─── Read / write ──────────────────────────────────────────────

export function getSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return cloneDefaults()
    let parsed = JSON.parse(raw)

    // Migrations
    parsed = migrate(parsed)

    // Merge with defaults to fill any gaps
    return {
      ...DEFAULTS,
      ...parsed,
      patterns: {
        original: { ...DEFAULTS.patterns.original, ...(parsed.patterns?.original || {}) },
        'until-recovery': { ...DEFAULTS.patterns['until-recovery'], ...(parsed.patterns?.['until-recovery'] || {}) },
      },
      dayOverrides: { ...(parsed.dayOverrides || {}) },
      phaseHistory: Array.isArray(parsed.phaseHistory) ? parsed.phaseHistory : [],
      trialStatus: { ...(parsed.trialStatus || {}) },
      dismissedSuggestions: { ...(parsed.dismissedSuggestions || {}) },
      overrideTracking: { ...(parsed.overrideTracking || {}) },
      recalibratedWeights: { ...(parsed.recalibratedWeights || {}) },
      customWorkouts: { ...(parsed.customWorkouts || {}) },
      customExercises: { ...(parsed.customExercises || {}) },
      stateVersion: STATE_VERSION,
    }
  } catch {
    return cloneDefaults()
  }
}

export function setSettings(patch) {
  const cur = getSettings()
  const next = { ...cur, ...patch, stateVersion: STATE_VERSION }
  localStorage.setItem(KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('settings-changed', { detail: next }))
  return next
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULTS))
}

function migrate(parsed) {
  const v = Number(parsed.stateVersion || parsed.patternVersion || 0)

  // v0/v1/v2: legacy `defaultPattern` keyed by weekday → folded into
  // patterns.original and the user is placed in 'original' phase.
  if (!parsed.patterns && parsed.defaultPattern) {
    parsed.patterns = {
      original: { ...DEFAULTS.patterns.original, ...parsed.defaultPattern },
      'until-recovery': { ...DEFAULTS.patterns['until-recovery'] },
    }
    delete parsed.defaultPattern
  }
  if (!parsed.activePhase) parsed.activePhase = 'original'

  // v < 4: bring up newly-added keys with defaults.
  if (v < 4) {
    parsed.phaseHistory = parsed.phaseHistory || []
    parsed.trialStatus = parsed.trialStatus || {}
    parsed.dismissedSuggestions = parsed.dismissedSuggestions || {}
    parsed.overrideTracking = parsed.overrideTracking || {}
    parsed.recalibratedWeights = parsed.recalibratedWeights || {}
  }

  return parsed
}

// ─── Phase API ──────────────────────────────────────────────────

export function setActivePhase(phase) {
  if (phase !== 'original' && phase !== 'until-recovery') return
  const cur = getSettings()
  if (cur.activePhase === phase) return cur
  const event = {
    from: cur.activePhase,
    to: phase,
    isoDate: toISODate(new Date()),
    timestamp: Date.now(),
  }
  return setSettings({
    activePhase: phase,
    phaseHistory: [...cur.phaseHistory, event],
  })
}

export function setPatternEntry(phase, weekday, workoutType) {
  const cur = getSettings()
  const phasePattern = { ...(cur.patterns[phase] || {}), [weekday]: workoutType }
  return setSettings({
    patterns: { ...cur.patterns, [phase]: phasePattern },
  })
}

// ─── Day override ──────────────────────────────────────────────

export function setDayOverride(isoDate, workoutType) {
  const cur = getSettings()
  const overrides = { ...cur.dayOverrides }
  if (workoutType == null) delete overrides[isoDate]
  else overrides[isoDate] = workoutType
  return setSettings({ dayOverrides: overrides })
}

export function clearAllOverrides() {
  return setSettings({ dayOverrides: {} })
}

// ─── Trial-flag state ──────────────────────────────────────────

export function trialKey(phase, exerciseName) {
  return `${phase}::${exerciseName}`
}

export function getTrialStatus(phase, exerciseName) {
  const s = getSettings()
  return s.trialStatus[trialKey(phase, exerciseName)] || null
}

/** status: 'pending' | 'cleared' | 'removed' */
export function setTrialStatus(phase, exerciseName, status) {
  const cur = getSettings()
  const trialStatus = {
    ...cur.trialStatus,
    [trialKey(phase, exerciseName)]: { status, isoDate: toISODate(new Date()) },
  }
  return setSettings({ trialStatus })
}

// ─── Dismissed suggestions ──────────────────────────────────────

export function isSuggestionDismissed(exerciseName) {
  const s = getSettings()
  return !!s.dismissedSuggestions[exerciseName]
}

export function dismissSuggestion(exerciseName) {
  const cur = getSettings()
  return setSettings({
    dismissedSuggestions: {
      ...cur.dismissedSuggestions,
      [exerciseName]: { isoDate: toISODate(new Date()) },
    },
  })
}

export function undismissSuggestion(exerciseName) {
  const cur = getSettings()
  const next = { ...cur.dismissedSuggestions }
  delete next[exerciseName]
  return setSettings({ dismissedSuggestions: next })
}

// ─── Override tracking ──────────────────────────────────────────

export function recordOverrideOutcome(exerciseName, suggestion, actualWeight, actualReps) {
  // Compare actual to suggestion. If user "followed" the suggestion (within
  // 0.5kg of suggested weight AND reps within 1), reset streak. Otherwise
  // increment.
  const cur = getSettings()
  const prior = cur.overrideTracking[exerciseName] || { streak: 0 }
  const followed =
    Math.abs((suggestion.weight ?? 0) - (Number(actualWeight) || 0)) <= 0.5 &&
    Math.abs((suggestion.reps ?? 0) - (Number(actualReps) || 0)) <= 1
  const streak = followed ? 0 : (prior.streak || 0) + 1
  return setSettings({
    overrideTracking: {
      ...cur.overrideTracking,
      [exerciseName]: { streak, lastSuggestion: suggestion },
    },
  })
}

export function shouldPromptRecalibrate(exerciseName) {
  const s = getSettings()
  const t = s.overrideTracking[exerciseName]
  return !!(t && t.streak >= 3)
}

export function setRecalibratedWeight(exerciseName, weight) {
  const cur = getSettings()
  return setSettings({
    recalibratedWeights: {
      ...cur.recalibratedWeights,
      [exerciseName]: { weight: Number(weight), isoDate: toISODate(new Date()) },
    },
    // Reset override streak for this exercise — they've recalibrated.
    overrideTracking: {
      ...cur.overrideTracking,
      [exerciseName]: { streak: 0, lastSuggestion: null },
    },
  })
}

// ─── Computed views ────────────────────────────────────────────

export function isConfigured() {
  const { appsScriptUrl, password } = getSettings()
  return !!(appsScriptUrl && password)
}

/** Workout type assigned to a Date. Day overrides win over phase pattern. */
export function workoutTypeForDate(date) {
  const s = getSettings()
  const iso = toISODate(date)
  if (s.dayOverrides[iso] !== undefined) return s.dayOverrides[iso]
  const phase = s.activePhase || 'original'
  const dow = date.getDay()
  return s.patterns[phase]?.[dow] || 'Rest'
}

export function activePhase() {
  return getSettings().activePhase || 'original'
}

/** YYYY-MM-DD in local time. */
export function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─── Custom workouts / exercises ───────────────────────────────

export function getCustomWorkouts() {
  return getSettings().customWorkouts || {}
}

export function getCustomExercises() {
  return getSettings().customExercises || {}
}

export function addCustomWorkout(workout) {
  // workout: { name, title, duration, phase, exercises: [] }
  if (!workout?.name) return
  const cur = getSettings()
  return setSettings({
    customWorkouts: {
      ...cur.customWorkouts,
      [workout.name]: {
        title: workout.title || workout.name,
        duration: workout.duration || '~45 min',
        phase: workout.phase || 'original',
        exercises: workout.exercises || [],
      },
    },
  })
}

export function deleteCustomWorkout(name) {
  const cur = getSettings()
  const next = { ...cur.customWorkouts }
  delete next[name]
  return setSettings({ customWorkouts: next })
}

export function addCustomExercise(workoutType, exercise) {
  // exercise: { name, sets, reps, weight, group, category, muscleGroup, note }
  if (!workoutType || !exercise?.name) return
  const cur = getSettings()
  // If the workout is custom (not in PROGRAM), append to its exercises
  // directly. Otherwise append to customExercises[workoutType].
  if (cur.customWorkouts[workoutType]) {
    return setSettings({
      customWorkouts: {
        ...cur.customWorkouts,
        [workoutType]: {
          ...cur.customWorkouts[workoutType],
          exercises: [...(cur.customWorkouts[workoutType].exercises || []), exercise],
        },
      },
    })
  }
  return setSettings({
    customExercises: {
      ...cur.customExercises,
      [workoutType]: [...(cur.customExercises[workoutType] || []), exercise],
    },
  })
}

export function deleteCustomExercise(workoutType, exerciseName) {
  const cur = getSettings()
  // Try custom workout first
  if (cur.customWorkouts[workoutType]) {
    const filtered = (cur.customWorkouts[workoutType].exercises || [])
      .filter(e => e.name !== exerciseName)
    return setSettings({
      customWorkouts: {
        ...cur.customWorkouts,
        [workoutType]: { ...cur.customWorkouts[workoutType], exercises: filtered },
      },
    })
  }
  // Otherwise pull from customExercises[workoutType]
  const filtered = (cur.customExercises[workoutType] || []).filter(e => e.name !== exerciseName)
  return setSettings({
    customExercises: { ...cur.customExercises, [workoutType]: filtered },
  })
}
