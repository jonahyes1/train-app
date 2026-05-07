import React from 'react'
import Header from './components/layout/Header'
import BottomNav from './components/layout/BottomNav'
import CalendarHome from './components/calendar/CalendarHome'
import QuickLog from './components/quicklog/QuickLog'
import RoutinesList from './components/routines/RoutinesList'
import GuidedSession from './components/session/GuidedSession'
import HistoryView from './components/history/HistoryView'
import ProgressView from './components/progress/ProgressView'
import useAppStore from './store/useAppStore'

export default function App() {
  const { view } = useAppStore()

  return (
    <div className="flex flex-col h-screen max-h-screen bg-bg overflow-hidden">
      <Header />
      <main className="flex-1 overflow-hidden flex flex-col">
        {view === 'calendar' && <CalendarHome />}
        {view === 'quicklog' && <QuickLog />}
        {view === 'splits' && <RoutinesList />}
        {view === 'workout' && <GuidedSession />}
        {view === 'history' && <HistoryView />}
        {view === 'progress' && <ProgressView />}
      </main>
      <BottomNav />
    </div>
  )
}
