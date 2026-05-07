import React from 'react'
import { Dumbbell, Timer } from 'lucide-react'
import useAppStore from '../../store/useAppStore'

export default function Header() {
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const sessions = useAppStore((s) => s.sessions)
  const session = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : null

  return (
    <header className="h-12 bg-bg-1 border-b border-bg-3 flex items-center justify-between px-4 flex-shrink-0 z-20">
      <div className="flex items-center gap-2">
        <Dumbbell size={18} className="text-accent" />
        <span className="font-bold text-base tracking-tight text-white">Grind</span>
      </div>

      {session && (
        <div className="flex items-center gap-1.5 text-success text-xs font-semibold">
          <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
          Workout Active
        </div>
      )}
    </header>
  )
}
