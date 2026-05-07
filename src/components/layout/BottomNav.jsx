import React from 'react'
import { CalendarDays, LayoutGrid, Clock, Play, BarChart2 } from 'lucide-react'
import useAppStore from '../../store/useAppStore'

export default function BottomNav() {
  const { view, setView, activeSessionId } = useAppStore()

  return (
    <nav className="h-16 bg-bg-1 border-t border-bg-3 flex items-center justify-around px-2 flex-shrink-0 z-20 pb-safe">
      <NavItem icon={<CalendarDays size={22} />} label="Home" active={view === 'calendar'} onClick={() => setView('calendar')} />
      <NavItem icon={<LayoutGrid size={22} />} label="Routines" active={view === 'splits'} onClick={() => setView('splits')} />
      {activeSessionId ? (
        <NavItem
          icon={
            <div className="relative">
              <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center -mt-5 shadow-lg shadow-accent/30">
                <Play size={18} className="text-white ml-0.5" />
              </div>
            </div>
          }
          label="Active"
          active={view === 'workout'}
          onClick={() => setView('workout')}
          pulse
        />
      ) : (
        <div className="w-16" />
      )}
      <NavItem icon={<Clock size={22} />} label="History" active={view === 'history'} onClick={() => setView('history')} />
      <NavItem icon={<BarChart2 size={22} />} label="Progress" active={view === 'progress'} onClick={() => setView('progress')} />
    </nav>
  )
}

function NavItem({ icon, label, active, onClick, pulse }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[52px] relative transition-colors ${
        active ? 'text-accent' : 'text-txt-muted'
      }`}
    >
      {pulse && (
        <span className="absolute top-0 right-1 w-2 h-2 bg-success rounded-full" />
      )}
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}
