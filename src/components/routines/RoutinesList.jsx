// src/components/routines/RoutinesList.jsx
// Phase-aware program catalog with custom-workout support. From the list
// view you can add a brand-new custom workout. From a detail view you can
// append custom exercises to any workout (builtin or custom) and delete
// any custom additions. Builtin exercises cannot be deleted from the UI.

import React, { useMemo, useState } from 'react'
import {
  ChevronRight, ArrowLeft, ClipboardList, Heart, Activity,
  Plus, Trash2, X,
} from 'lucide-react'
import {
  PROGRAM, WORKOUT_TYPES_ORIGINAL, WORKOUT_TYPES_RECOVERY,
  workoutTypesInPhase, exercisesFor, titleFor, phaseFor, MUSCLE_GROUP_LIST,
} from '../../lib/program'
import {
  workoutTypeForDate, toISODate, activePhase, getTrialStatus,
  getCustomWorkouts, getCustomExercises,
  addCustomWorkout, addCustomExercise,
  deleteCustomWorkout, deleteCustomExercise,
} from '../../lib/settings'
import { useSheetData } from '../../lib/useSheetData'
import { suggestNext } from '../../lib/suggest'
import useAppStore from '../../store/useAppStore'

export default function RoutinesList() {
  const [selected, setSelected] = useState(null)
  const [addingWorkout, setAddingWorkout] = useState(false)
  const [, forceTick] = useState(0)
  const phase = activePhase()
  const order = workoutTypesInPhase(phase).filter(t => t !== 'Rest')
  const customWorkouts = getCustomWorkouts()

  if (selected) {
    return (
      <RoutineDetail
        workoutType={selected}
        onBack={() => { setSelected(null); forceTick(n => n + 1) }}
      />
    )
  }

  const handleDeleteWorkout = (name) => {
    if (!confirm(`Delete custom workout "${name}"? Logs in your Sheet are kept; only the workout definition is removed.`)) return
    deleteCustomWorkout(name)
    forceTick(n => n + 1)
  }

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      <div className="px-4 pt-5 pb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white">Routines</h1>
            <PhasePill phase={phase} />
          </div>
          <p className="text-xs text-txt-secondary">
            {phase === 'until-recovery'
              ? 'Recovery phase — upper-body focus.'
              : 'Your standard 4-day program.'}
          </p>
        </div>
        <button
          onClick={() => setAddingWorkout(true)}
          className="bg-bg-2 hover:bg-bg-3 border border-bg-3 text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 flex items-center gap-1"
        >
          <Plus size={13} /> New
        </button>
      </div>

      <div className="px-4 space-y-2">
        {order.map(key => {
          const entry = PROGRAM[key] || customWorkouts[key]
          if (!entry) return null
          const isCustom = !PROGRAM[key]
          const exCount = exercisesFor(key).length
          return (
            <div
              key={key}
              className="flex items-stretch gap-2"
            >
              <button
                onClick={() => setSelected(key)}
                className="flex-1 flex items-center gap-3 bg-bg-1 border border-bg-3 rounded-2xl px-4 py-3.5 text-left hover:border-accent/60"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${badge(key)}`}>
                  <span className="text-xs font-bold">{shortLabel(key)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-white text-[15px] leading-tight truncate">{entry.title}</p>
                    {isCustom && (
                      <span className="bg-accent/15 border border-accent/40 text-accent-light px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Custom</span>
                    )}
                  </div>
                  <p className="text-[11px] text-txt-muted mt-0.5">
                    {exCount} exercises · {entry.duration || '~45 min'}
                  </p>
                </div>
                <ChevronRight size={16} className="text-txt-muted flex-shrink-0" />
              </button>
              {isCustom && (
                <button
                  onClick={() => handleDeleteWorkout(key)}
                  className="px-2 bg-bg-1 border border-bg-3 rounded-2xl text-txt-muted hover:text-danger hover:border-danger/50 flex items-center"
                  aria-label="Delete custom workout"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {addingWorkout && (
        <NewWorkoutModal
          defaultPhase={phase}
          onCancel={() => setAddingWorkout(false)}
          onSave={(w) => {
            addCustomWorkout(w)
            setAddingWorkout(false)
            forceTick(n => n + 1)
          }}
        />
      )}
    </div>
  )
}

// ─── Detail ─────────────────────────────────────────────────────

function RoutineDetail({ workoutType, onBack }) {
  const [, forceTick] = useState(0)
  const [adding, setAdding] = useState(false)
  const openQuickLog = useAppStore(s => s.openQuickLog)
  const { rows } = useSheetData()
  const phase = phaseFor(workoutType) || activePhase()

  const allExercises = exercisesFor(workoutType)
  const customNames = new Set([
    ...((getCustomWorkouts()[workoutType]?.exercises) || []).map(e => e.name),
    ...((getCustomExercises()[workoutType]) || []).map(e => e.name),
  ])

  const visibleExercises = useMemo(() => {
    return allExercises.filter(ex => {
      const t = getTrialStatus(phase, ex.name)
      return !t || t.status !== 'removed'
    })
  }, [allExercises, phase])

  const groups = {}
  for (const ex of visibleExercises) (groups[ex.group || 'Custom'] ||= []).push(ex)

  const nextISO = findNextScheduledDate(workoutType)
  const builtinTitle = PROGRAM[workoutType]?.title || titleFor(workoutType)
  const duration = PROGRAM[workoutType]?.duration || getCustomWorkouts()[workoutType]?.duration || '~45 min'

  const handleDelete = (exerciseName) => {
    if (!confirm(`Remove "${exerciseName}" from ${workoutType}? Logs in your Sheet are kept.`)) return
    deleteCustomExercise(workoutType, exerciseName)
    forceTick(n => n + 1)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-bg-1 border-b border-bg-3 flex-shrink-0">
        <button onClick={onBack} className="p-1 -ml-1 text-txt-secondary hover:text-white" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-txt-muted uppercase tracking-wider">{workoutType}</div>
          <div className="text-white font-bold text-sm truncate">{builtinTitle}</div>
        </div>
        <div className="text-[11px] text-txt-muted whitespace-nowrap">{duration}</div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {Object.entries(groups).map(([groupName, exes]) => (
          <div key={groupName}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-accent-light px-2 mb-1.5">
              {groupName}
            </div>
            <div className="space-y-1.5">
              {exes.map((ex, i) => (
                <ExerciseRow
                  key={ex.name + i}
                  ex={ex}
                  rows={rows}
                  phase={phase}
                  isCustom={customNames.has(ex.name)}
                  onDelete={() => handleDelete(ex.name)}
                />
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={() => setAdding(true)}
          className="w-full text-[12px] text-txt-secondary hover:text-white border border-dashed border-bg-3 hover:border-accent/60 rounded-md py-2 flex items-center justify-center gap-1 mt-2"
        >
          <Plus size={13} /> Add exercise to this workout
        </button>

        <div className="h-2" />
      </div>

      <div className="flex-shrink-0 px-3 py-3 bg-bg-1 border-t border-bg-3">
        <button
          onClick={() => openQuickLog(nextISO)}
          className="w-full bg-accent hover:bg-accent-dark text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2"
        >
          <ClipboardList size={18} />
          Quick Log {prettyDate(nextISO)}
        </button>
      </div>

      {adding && (
        <NewExerciseModal
          existingGroups={Object.keys(groups)}
          onCancel={() => setAdding(false)}
          onSave={(ex) => {
            addCustomExercise(workoutType, ex)
            setAdding(false)
            forceTick(n => n + 1)
          }}
        />
      )}
    </div>
  )
}

function ExerciseRow({ ex, rows, phase, isCustom, onDelete }) {
  const target = `${ex.sets}×${ex.reps || '—'}${ex.weight ? ` @ ${ex.weight}kg` : ''}`
  const trial = getTrialStatus(phase, ex.name)
  const suggestion = useMemo(() => suggestNext(ex, rows), [ex, rows])
  const hasHistory = !!suggestion && !suggestion.coldStart

  return (
    <div className="bg-bg-1 border border-bg-3 rounded-xl px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-white font-semibold text-sm leading-tight truncate">{ex.name}</span>
          {isCustom && (
            <span className="bg-accent/15 border border-accent/40 text-accent-light px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Custom</span>
          )}
          {trial?.status === 'pending' || (ex.trial && !trial) ? (
            <span className="bg-warn/15 border border-warn/40 text-warn px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Trial</span>
          ) : trial?.status === 'cleared' ? (
            <span className="bg-success/15 border border-success/40 text-success px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">Cleared</span>
          ) : null}
        </div>
        <span className="text-[11px] text-txt-secondary font-mono tabular-nums whitespace-nowrap">{target}</span>
        {isCustom && (
          <button
            onClick={onDelete}
            className="text-txt-muted hover:text-danger -mr-1"
            aria-label="Delete custom exercise"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {ex.note && (
        <div className="text-[11px] text-txt-muted italic mt-1 leading-snug">{ex.note}</div>
      )}
      {hasHistory && (
        <div className="text-[11px] text-accent-light mt-1 leading-snug">
          → Next: {suggestion.headline}
        </div>
      )}
    </div>
  )
}

// ─── New Workout modal ─────────────────────────────────────────

function NewWorkoutModal({ defaultPhase, onCancel, onSave }) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState('~45 min')
  const [phase, setPhase] = useState(defaultPhase || 'original')

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({
      name: trimmed,
      title: title.trim() || trimmed,
      duration: duration.trim() || '~45 min',
      phase,
      exercises: [],
    })
  }

  return (
    <ModalShell title="New Workout" onCancel={onCancel}>
      <Field label="Name (shows in calendar / picker)">
        <input value={name} onChange={e => setName(e.target.value)}
               placeholder="e.g. Cardio + Mobility"
               className="modal-input"
               autoFocus />
      </Field>
      <Field label="Display title (optional)">
        <input value={title} onChange={e => setTitle(e.target.value)}
               placeholder="Defaults to name"
               className="modal-input" />
      </Field>
      <Field label="Duration label">
        <input value={duration} onChange={e => setDuration(e.target.value)}
               className="modal-input" />
      </Field>
      <Field label="Phase">
        <select value={phase} onChange={e => setPhase(e.target.value)} className="modal-input">
          <option value="original">Original</option>
          <option value="until-recovery">Until Recovery</option>
        </select>
      </Field>
      <ModalActions onCancel={onCancel} onSubmit={submit} disabled={!name.trim()} submitLabel="Create" />
    </ModalShell>
  )
}

// ─── New Exercise modal ────────────────────────────────────────

function NewExerciseModal({ existingGroups, onCancel, onSave }) {
  const [name, setName] = useState('')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('10')
  const [weight, setWeight] = useState('')
  const [group, setGroup] = useState(existingGroups?.[existingGroups.length - 1] || 'Accessory')
  const [category, setCategory] = useState('accessory')
  const [muscleGroup, setMuscleGroup] = useState('Chest')
  const [note, setNote] = useState('')

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({
      name: trimmed,
      sets: Number(sets) || 3,
      reps: Number(reps) || 0,
      weight: weight === '' ? 0 : Number(weight) || 0,
      group: group.trim() || 'Custom',
      category,
      muscleGroup,
      note: note.trim(),
    })
  }

  return (
    <ModalShell title="Add Exercise" onCancel={onCancel}>
      <Field label="Exercise name">
        <input value={name} onChange={e => setName(e.target.value)}
               placeholder="e.g. Cable Pull-Through"
               className="modal-input" autoFocus />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Sets"><input value={sets} onChange={e => setSets(e.target.value)} inputMode="numeric" className="modal-input text-center" /></Field>
        <Field label="Reps"><input value={reps} onChange={e => setReps(e.target.value)} inputMode="numeric" className="modal-input text-center" /></Field>
        <Field label="Weight kg"><input value={weight} onChange={e => setWeight(e.target.value)} inputMode="decimal" placeholder="0" className="modal-input text-center" /></Field>
      </div>
      <Field label="Group label (e.g. 'Main', 'Superset A')">
        <input value={group} onChange={e => setGroup(e.target.value)} className="modal-input" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Category">
          <select value={category} onChange={e => setCategory(e.target.value)} className="modal-input">
            <option value="main">Main lift</option>
            <option value="weighted-bw">Weighted bodyweight</option>
            <option value="accessory">Accessory</option>
            <option value="rehab">Rehab</option>
            <option value="amrap">AMRAP / Max reps</option>
            <option value="time">Time hold</option>
          </select>
        </Field>
        <Field label="Muscle group">
          <select value={muscleGroup} onChange={e => setMuscleGroup(e.target.value)} className="modal-input">
            {MUSCLE_GROUP_LIST.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Note (optional)">
        <input value={note} onChange={e => setNote(e.target.value)}
               placeholder="Coaching cue, tempo, etc."
               className="modal-input" />
      </Field>
      <ModalActions onCancel={onCancel} onSubmit={submit} disabled={!name.trim()} submitLabel="Add" />
    </ModalShell>
  )
}

// ─── Modal scaffolding ─────────────────────────────────────────

function ModalShell({ title, onCancel, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-bg-1 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-bg-3 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-3">
          <h3 className="text-white font-bold text-base">{title}</h3>
          <button onClick={onCancel} className="p-1 text-txt-muted hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <style>{`.modal-input { width:100%; background:#1E1E1E; color:#fff; font-size:14px; border-radius:8px; padding:10px 12px; border:1px solid #272727; outline:none; }
          .modal-input:focus { border-color: #4F86F7; }`}</style>
          {children}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-txt-secondary mb-1 tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function ModalActions({ onCancel, onSubmit, disabled, submitLabel }) {
  return (
    <div className="px-5 py-4 border-t border-bg-3 flex gap-2 -mx-5 -mb-4">
      <button onClick={onCancel} className="flex-1 bg-bg-2 hover:bg-bg-3 text-white text-sm font-semibold rounded-lg py-2.5">
        Cancel
      </button>
      <button onClick={onSubmit} disabled={disabled}
              className="flex-1 bg-accent hover:bg-accent-dark disabled:opacity-40 text-white text-sm font-semibold rounded-lg py-2.5">
        {submitLabel}
      </button>
    </div>
  )
}

// ─── Visual helpers ────────────────────────────────────────────

function PhasePill({ phase }) {
  if (phase === 'until-recovery') {
    return (
      <span className="flex items-center gap-1 bg-warn/10 border border-warn/30 text-warn rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        <Heart size={10} /> Recovery
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 bg-accent/10 border border-accent/30 text-accent-light rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
      <Activity size={10} /> Original
    </span>
  )
}

function shortLabel(key) {
  if (/upper a.*until/i.test(key)) return 'UA·R'
  if (/upper b.*until/i.test(key)) return 'UB·R'
  if (/recovery.*core a/i.test(key)) return 'R+A'
  if (/recovery.*core b/i.test(key)) return 'R+B'
  return key.split(/\s+/).filter(w => /^[A-Za-z0-9]/.test(w)).map(w => w[0]).join('').toUpperCase().slice(0, 4)
}

function badge(key) {
  const k = key.toLowerCase()
  if (k.startsWith('upper')) return 'bg-accent/15 text-accent-light'
  if (k.startsWith('lower')) return 'bg-success/15 text-success'
  if (k.startsWith('recovery')) return 'bg-warn/15 text-warn'
  return 'bg-bg-2 text-txt-secondary'
}

function findNextScheduledDate(workoutType) {
  const now = new Date()
  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    if (workoutTypeForDate(d) === workoutType) return toISODate(d)
  }
  return toISODate(now)
}

function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(date); target.setHours(0,0,0,0)
  const diffDays = Math.round((target - today) / 86_400_000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' })
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
