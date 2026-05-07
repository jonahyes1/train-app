import React, { useState } from 'react'
import { Trophy, ChevronRight, ChevronDown, ChevronUp, Trash2, Calendar } from 'lucide-react'
import useAppStore from '../../store/useAppStore'
import { formatDate } from '../../utils/youtube'

export default function HistoryView() {
  const { sessions, deleteSession } = useAppStore()
  const [expanded, setExpanded] = useState(null)

  const completed = [...sessions]
    .filter(s => s.completed)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  if (completed.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-20 h-20 bg-bg-2 rounded-full flex items-center justify-center mb-4">
          <Calendar size={28} className="text-txt-muted" />
        </div>
        <p className="text-white font-semibold text-lg">No workouts logged yet</p>
        <p className="text-txt-secondary text-sm mt-1">Start a session from your Routines tab</p>
      </div>
    )
  }

  // Group by month
  const groups = {}
  completed.forEach(s => {
    const key = new Date(s.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  })

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-xl font-bold text-white">History</h1>
        <p className="text-xs text-txt-secondary mt-0.5">{completed.length} workout{completed.length !== 1 ? 's' : ''} logged</p>
      </div>

      <div className="pb-24">
        {Object.entries(groups).map(([month, sessions]) => (
          <div key={month}>
            <p className="px-4 py-2 text-xs font-semibold text-txt-muted uppercase tracking-widest">{month}</p>
            <div className="space-y-1 px-4">
              {sessions.map(sess => {
                const isExpanded = expanded === sess.id
                const totalSets = sess.exerciseLogs.reduce((sum, el) => sum + el.sets.length, 0)
                const prs = sess.exerciseLogs.reduce((sum, el) => sum + el.sets.filter(s => s.isPR).length, 0)

                return (
                  <div key={sess.id} className="bg-bg-2 rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      onClick={() => setExpanded(isExpanded ? null : sess.id)}
                    >
                      <div className="w-10 h-10 bg-bg-3 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white leading-none">
                          {new Date(sess.date).getDate()}
                        </span>
                        <span className="text-[9px] text-txt-muted uppercase">
                          {new Date(sess.date).toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-[14px]">{sess.dayName}</p>
                        <p className="text-xs text-txt-secondary">{sess.splitName}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-txt-muted">{totalSets} sets</span>
                          {prs > 0 && (
                            <span className="flex items-center gap-1 text-xs text-warn font-semibold">
                              <Trophy size={10} /> {prs} PR{prs !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-txt-muted flex-shrink-0" /> : <ChevronRight size={16} className="text-txt-muted flex-shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-bg-3 px-4 py-3">
                        {sess.exerciseLogs.map(el => (
                          <div key={el.exerciseId} className="mb-3">
                            <p className="text-xs font-bold text-accent mb-1.5">{el.exerciseName}</p>
                            {el.note && <p className="text-xs text-txt-muted italic mb-1.5">"{el.note}"</p>}
                            <div className="space-y-1">
                              {el.sets.map((st, i) => (
                                <div key={st.id} className="flex items-center gap-3 text-xs">
                                  <span className="w-5 text-txt-muted">{i + 1}</span>
                                  <span className="font-semibold text-white">{st.weight} lb</span>
                                  <span className="text-txt-muted">×</span>
                                  <span className="text-txt-secondary">{st.reps} reps</span>
                                  {st.rpe && <span className="text-txt-muted">RPE {st.rpe}</span>}
                                  {st.isPR && <Trophy size={10} className="text-warn" />}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => { deleteSession(sess.id); setExpanded(null) }}
                          className="flex items-center gap-1.5 text-xs text-txt-muted hover:text-danger transition-colors mt-2"
                        >
                          <Trash2 size=  {12} /> Delete session
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
    </div>
  )
}
