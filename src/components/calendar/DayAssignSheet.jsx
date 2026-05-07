import React from 'react'
import { X, RotateCcw } from 'lucide-react'
import { setDayOverride, getSettings, workoutTypeForDate, activePhase } from '../../lib/settings'
import { workoutTypesInPhase } from '../../lib/program'

export default function DayAssignSheet({ iso, onClose }) {
  if (!iso) return null

  const settings = getSettings()
  const date = parseISO(iso)
  const phase = activePhase()
  const choices = workoutTypesInPhase(phase)
  const patternType = settings.patterns[phase]?.[date.getDay()] || 'Rest'
  const currentType = workoutTypeForDate(date)
  const isOverridden = settings.dayOverrides[iso] !== undefined

  const label = date.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const pick = (choice) => {
    setDayOverride(iso, choice)
    onClose?.()
  }

  const resetToPattern = () => {
    setDayOverride(iso, null)
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-bg-1 w-full sm:max-w-md rounded-t-2xl border-t border-x border-bg-3 p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-txt-muted">Assign workout</div>
            <div className="text-white font-bold text-base">{label}</div>
          </div>
          <button onClick={onClose} className="p-1 text-txt-muted hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="text-xs text-txt-secondary mb-3">
          Currently: <span className="text-white font-semibold">{currentType}</span>
          {isOverridden ? (
            <span className="text-accent"> (overridden)</span>
          ) : (
            <span className="text-txt-muted"> (default for {weekday(date)})</span>
          )}
        </div>

        <div className="text-[10px] uppercase tracking-wider text-txt-muted mb-2">
          {phase === 'until-recovery' ? 'Recovery phase choices' : 'Original phase choices'}
        </div>

        <div className="grid grid-cols-1 gap-2">
          {choices.map((c) => {
            const active = c === currentType
            return (
              <button
                key={c}
                onClick={() => pick(c)}
                className={`px-3 py-2.5 rounded-lg text-sm font-semibold border text-left ${
                  active
                    ? 'bg-accent text-white border-accent'
                    : 'bg-bg-2 text-white border-bg-3 hover:border-bg-5'
                }`}
              >
                {c}
              </button>
            )
          })}
        </div>

        {isOverridden && (
          <button
            onClick={resetToPattern}
            className="mt-4 w-full flex items-center justify-center gap-2 text-txt-secondary hover:text-white text-sm py-2.5 border border-bg-3 rounded-lg"
          >
            <RotateCcw size={14} />
            Reset to default pattern ({patternType})
          </button>
        )}
      </div>
    </div>
  )
}

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function weekday(d) {
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]
}
