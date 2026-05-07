import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, Check, Trash2, Trophy, Timer, Video, ChevronUp, ChevronDown } from 'lucide-react'
import useAppStore from '../../store/useAppStore'
import { formatDate } from '../../utils/youtube'
import VideoModal from '../video/VideoModal'

export default function WorkoutSession() {
  const { activeSessionId, sessions, completeSession, splits, getLastSessionForDay } = useAppStore()
  const session = sessions.find(s => s.id === activeSessionId)
  const [elapsed, setElapsed] = useState(0)
  const [confirmFinish, setConfirmFinish] = useState(false)

  useEffect(() => {
    if (!session) return
    const start = new Date(session.date).getTime()
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(tick)
  }, [session?.id])

  if (!session) return (
    <div className="flex-1 flex items-center justify-center text-txt-secondary text-sm">
      No active session
    </div>
  )

  const split = splits.find(s => s.id === session.splitId)
  const day = split?.days.find(d => d.id === session.dayId)
  const lastSession = getLastSessionForDay(session.splitId, session.dayId)

  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const secs = (elapsed % 60).toString().padStart(2, '0')

  const totalSets = session.exerciseLogs.reduce((sum, el) => sum + el.sets.length, 0)

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Session header */}
      <div className="bg-bg-2 px-4 pt-4 pb-3 sticky top-0 z-10 border-b border-bg-3">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-lg font-bold text-white">{session.dayName}</h1>
            <p className="text-xs text-txt-secondary">{session.splitName}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 text-success font-mono text-base font-bold">
              <Timer size={14} />
              {mins}:{secs}
            </div>
            <p className="text-xs text-txt-muted">{totalSets} sets</p>
          </div>
        </div>

        <button
          onClick={() => setConfirmFinish(true)}
          className="w-full bg-success text-white py-2.5 rounded-xl font-bold text-sm hover:bg-green-600 transition-colors mt-2"
        >
          Finish Workout
        </button>
      </div>

      {/* Exercise logs */}
      <div className="pb-24 pt-2">
        {session.exerciseLogs.map((el) => {
          const exerciseData = day?.exercises.find(e => e.id === el.exerciseId)
          const lastLog = lastSession?.exerciseLogs.find(l => l.exerciseId === el.exerciseId)
          return (
            <ExerciseLog
              key={el.exerciseId}
              log={el}
              exerciseData={exerciseData}
              lastLog={lastLog}
              sessionId={session.id}
            />
          )
        })}
      </div>

      {confirmFinish && (
        <ConfirmModal
          title="Finish workout?"
          message={`You've logged ${totalSets} sets. Ready to wrap up?`}
          confirmLabel="Finish"
          confirmClass="bg-success"
          onConfirm={() => completeSession(activeSessionId)}
          onCancel={() => setConfirmFinish(false)}
        />
      )}
    </div>
  )
}

function ExerciseLog({ log, exerciseData, lastLog, sessionId }) {
  const { addSet, updateSet, deleteSet, addExerciseNote, getPersonalRecord } = useAppStore()
  const [showNote, setShowNote] = useState(!!log.note)
  const [note, setNote] = useState(log.note || '')
  const [restTimer, setRestTimer] = useState(null)
  const [restElapsed, setRestElapsed] = useState(0)
  const restRef = useRef(null)
  const [videoOpen, setVideoOpen] = useState(false)
  const pr = getPersonalRecord(log.exerciseName)

  useEffect(() => {
    if (restTimer !== null) {
      restRef.current = setInterval(() => setRestElapsed(e => e + 1), 1000)
    } else {
      clearInterval(restRef.current)
      setRestElapsed(0)
    }
    return () => clearInterval(restRef.current)
  }, [restTimer])

  const handleAddSet = () => {
    const lastSet = log.sets[log.sets.length - 1]
    const lastSessionLastSet = lastLog?.sets[log.sets.length] || lastLog?.sets[lastLog.sets.length - 1]
    addSet(sessionId, log.exerciseId, {
      weight: lastSet?.weight || lastSessionLastSet?.weight || '',
      reps: lastSet?.reps || lastSessionLastSet?.reps || '',
      rpe: '',
      completed: false,
      isPR: false,
    })
  }

  const handleComplete = (setId, set) => {
    const weight = parseFloat(set.weight) || 0
    const isPR = weight > 0 && pr !== null && weight > pr
    updateSet(sessionId, log.exerciseId, setId, { completed: !set.completed, isPR: isPR && !set.completed })
    if (!set.completed) {
      setRestTimer(Date.now())
    }
  }

  const restMins = Math.floor(restElapsed / 60).toString().padStart(2, '0')
  const restSecs = (restElapsed % 60).toString().padStart(2, '0')

  return (
    <div className="mb-1">
      {/* Exercise header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {exerciseData?.videoId && (
            <button onClick={() => setVideoOpen(true)} className="w-7 h-7 rounded-lg overflow-hidden ring-1 ring-bg-4 hover:ring-accent flex-shrink-0">
              <img src={`https://img.youtube.com/vi/${exerciseData.videoId}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" />
            </button>
          )}
          <p className="font-bold text-accent text-[15px]">{log.exerciseName}</p>
          {pr !== null && <span className="text-xs text-warn font-semibold">PR: {pr}lb</span>}
        </div>
        <button onClick={() => setShowNote(!showNote)} className="text-txt-muted hover:text-white p-1">
          {showNote ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Rest timer */}
      {restTimer !== null && (
        <div className="mx-4 mb-2 bg-bg-3 rounded-xl px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer size={14} className="text-accent" />
            <span className="text-xs text-txt-secondary font-medium">Rest</span>
          </div>
          <span className="font-mono text-white font-bold text-sm">{restMins}:{restSecs}</span>
          <button onClick={() => setRestTimer(null)} className="text-xs text-txt-muted hover:text-white">Done</button>
        </div>
      )}

      {/* Note */}
      {showNote && (
        <div className="px-4 mb-2">
          <input
            value={note}
            onChange={e => { setNote(e.target.value); addExerciseNote(sessionId, log.exerciseId, e.target.value) }}
            placeholder="Add a note..."
            className="w-full bg-bg-3 rounded-xl px-3 py-2 text-sm text-white placeholder-txt-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      )}

      {/* Sets table header */}
      <div className="grid grid-cols-[32px_1fr_1fr_1fr_40px] gap-1 px-4 mb-1">
        <span className="text-[11px] text-txt-muted font-semibold">SET</span>
        <span className="text-[11px] text-txt-muted font-semibold">PREV</span>
        <span className="text-[11px] text-txt-muted font-semibold text-center">LBS</span>
        <span className="text-[11px] text-txt-muted font-semibold text-center">REPS</span>
        <span />
      </div>

      {/* Sets */}
      <div className="space-y-1 px-4">
        {log.sets.map((set, i) => (
          <SetRow
            key={set.id}
            set={set}
            index={i}
            lastSet={lastLog?.sets[i]}
            onUpdate={(updates) => updateSet(sessionId, log.exerciseId, set.id, updates)}
            onDelete={() => deleteSet(sessionId, log.exerciseId, set.id)}
            onComplete={() => handleComplete(set.id, set)}
          />
        ))}
      </div>

      {/* Add set */}
      <div className="px-4 mt-2">
        <button onClick={handleAddSet} className="w-full flex items-center justify-center gap-2 bg-bg-3 hover:bg-bg-4 text-txt-secondary hover:text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
          <Plus size={15} /> Add Set
        </button>
      </div>

      <div className="h-px bg-bg-3 mx-4 mt-3" />

      {videoOpen && exerciseData && (
        <VideoModal exercise={exerciseData} onSave={() => setVideoOpen(false)} onClose={() => setVideoOpen(false)} />
      )}
    </div>
  )
}

function SetRow({ set, index, lastSet, onUpdate, onDelete, onComplete }) {
  const prevText = lastSet ? `${lastSet.weight}×${lastSet.reps}` : '—'

  return (
    <div className={`grid grid-cols-[32px_1fr_1fr_1fr_40px] gap-1 items-center rounded-xl px-2 py-1.5 transition-colors ${
      set.completed ? 'bg-success/10' : 'bg-bg-2'
    }`}>
      <span className={`text-xs font-bold text-center ${set.completed ? 'text-success' : 'text-txt-muted'}`}>
        {set.isPR ? <Trophy size={13} className="text-warn mx-auto" /> : index + 1}
      </span>
      <span className="text-xs text-txt-muted text-center">{prevText}</span>
      <input
        type="number"
        value={set.weight}
        onChange={e => onUpdate({ weight: e.target.value })}
        placeholder="0"
        className="bg-bg-3 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-accent w-full"
      />
      <input
        type="number"
        value={set.reps}
        onChange={e => onUpdate({ reps: e.target.value })}
        placeholder="0"
        className="bg-bg-3 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-accent w-full"
      />
      <div className="flex items-center justify-end gap-1">
        <button onClick={onComplete} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
          set.completed ? 'bg-success text-white' : 'bg-bg-4 text-txt-muted hover:bg-bg-5 hover:text-white'
        }`}>
          <Check size={13} />
        </button>
      </div>
    </div>
  )
}

function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
      <div className="bg-bg-2 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-white text-lg mb-1">{title}</h3>
        <p className="text-txt-secondary text-sm mb-5">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-bg-3 text-white py-3 rounded-xl font-semibold text-sm hover:bg-bg-4">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 ${confirmClass} text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
