import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from './nanoid'

const useAppStore = create(
  persist(
    (set, get) => ({
      // ─── Navigation ───────────────────────────────────────────────
      view: 'calendar', // 'calendar' | 'quicklog' | 'splits' | 'workout' | 'history' | 'progress'
      activeSplitId: null,
      activeDayIndex: null,
      activeSessionId: null,
      sidebarOpen: true,
      // ISO date (YYYY-MM-DD) that Quick Log / Guided Session should open against
      quickLogISO: null,
      sessionISO: null,

      setView: (view) => set({ view }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      openQuickLog: (iso) => set({ quickLogISO: iso, view: 'quicklog' }),
      startGuidedSession: (iso) => set({ sessionISO: iso, view: 'workout' }),
      endGuidedSession: () => set({ sessionISO: null, view: 'calendar' }),

      // ─── Splits ───────────────────────────────────────────────────
      splits: [],

      createSplit: (name) => {
        const split = { id: nanoid(), name, days: [] }
        set((s) => ({ splits: [...s.splits, split] }))
        return split.id
      },

      updateSplit: (splitId, updates) =>
        set((s) => ({
          splits: s.splits.map((sp) =>
            sp.id === splitId ? { ...sp, ...updates } : sp
          ),
        })),

      deleteSplit: (splitId) =>
        set((s) => ({
          splits: s.splits.filter((sp) => sp.id !== splitId),
          activeSplitId: s.activeSplitId === splitId ? null : s.activeSplitId,
        })),

      addDay: (splitId, name) =>
        set((s) => ({
          splits: s.splits.map((sp) =>
            sp.id === splitId
              ? { ...sp, days: [...sp.days, { id: nanoid(), name, exercises: [] }] }
              : sp
          ),
        })),

      updateDay: (splitId, dayId, updates) =>
        set((s) => ({
          splits: s.splits.map((sp) =>
            sp.id === splitId
              ? {
                  ...sp,
                  days: sp.days.map((d) =>
                    d.id === dayId ? { ...d, ...updates } : d
                  ),
                }
              : sp
          ),
        })),

      deleteDay: (splitId, dayId) =>
        set((s) => ({
          splits: s.splits.map((sp) =>
            sp.id === splitId
              ? { ...sp, days: sp.days.filter((d) => d.id !== dayId) }
              : sp
          ),
        })),

      reorderDays: (splitId, newDays) =>
        set((s) => ({
          splits: s.splits.map((sp) =>
            sp.id === splitId ? { ...sp, days: newDays } : sp
          ),
        })),

      addExercise: (splitId, dayId, name) =>
        set((s) => ({
          splits: s.splits.map((sp) =>
            sp.id === splitId
              ? {
                  ...sp,
                  days: sp.days.map((d) =>
                    d.id === dayId
                      ? {
                          ...d,
                          exercises: [
                            ...d.exercises,
                            { id: nanoid(), name, videoUrl: '', videoId: '', videoTitle: '' },
                          ],
                        }
                      : d
                  ),
                }
              : sp
          ),
        })),

      updateExercise: (splitId, dayId, exerciseId, updates) =>
        set((s) => ({
          splits: s.splits.map((sp) =>
            sp.id === splitId
              ? {
                  ...sp,
                  days: sp.days.map((d) =>
                    d.id === dayId
                      ? {
                          ...d,
                          exercises: d.exercises.map((ex) =>
                            ex.id === exerciseId ? { ...ex, ...updates } : ex
                          ),
                        }
                      : d
                  ),
                }
              : sp
          ),
        })),

      deleteExercise: (splitId, dayId, exerciseId) =>
        set((s) => ({
          splits: s.splits.map((sp) =>
            sp.id === splitId
              ? {
                  ...sp,
                  days: sp.days.map((d) =>
                    d.id === dayId
                      ? { ...d, exercises: d.exercises.filter((ex) => ex.id !== exerciseId) }
                      : d
                  ),
                }
              : sp
          ),
        })),

      reorderExercises: (splitId, dayId, newExercises) =>
        set((s) => ({
          splits: s.splits.map((sp) =>
            sp.id === splitId
              ? {
                  ...sp,
                  days: sp.days.map((d) =>
                    d.id === dayId ? { ...d, exercises: newExercises } : d
                  ),
                }
              : sp
          ),
        })),

      // ─── Workout Sessions ─────────────────────────────────────────
      sessions: [],

      startSession: (splitId, dayId) => {
        const state = get()
        const split = state.splits.find((s) => s.id === splitId)
        const day = split?.days.find((d) => d.id === dayId)
        if (!day) return null

        const exerciseLogs = day.exercises.map((ex) => ({
          exerciseId: ex.id,
          exerciseName: ex.name,
          sets: [],
        }))

        const session = {
          id: nanoid(),
          splitId,
          dayId,
          splitName: split.name,
          dayName: day.name,
          date: new Date().toISOString(),
          exerciseLogs,
          completed: false,
        }

        set((s) => ({
          sessions: [...s.sessions, session],
          activeSessionId: session.id,
          view: 'workout',
        }))
        return session.id
      },

      addSet: (sessionId, exerciseId, setData) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? {
                  ...sess,
                  exerciseLogs: sess.exerciseLogs.map((el) =>
                    el.exerciseId === exerciseId
                      ? {
                          ...el,
                          sets: [
                            ...el.sets,
                            { id: nanoid(), ...setData, timestamp: new Date().toISOString() },
                          ],
                        }
                      : el
                  ),
                }
              : sess
          ),
        })),

      updateSet: (sessionId, exerciseId, setId, updates) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? {
                  ...sess,
                  exerciseLogs: sess.exerciseLogs.map((el) =>
                    el.exerciseId === exerciseId
                      ? {
                          ...el,
                          sets: el.sets.map((st) =>
                            st.id === setId ? { ...st, ...updates } : st
                          ),
                        }
                      : el
                  ),
                }
              : sess
          ),
        })),

      deleteSet: (sessionId, exerciseId, setId) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? {
                  ...sess,
                  exerciseLogs: sess.exerciseLogs.map((el) =>
                    el.exerciseId === exerciseId
                      ? { ...el, sets: el.sets.filter((st) => st.id !== setId) }
                      : el
                  ),
                }
              : sess
          ),
        })),

      addExerciseNote: (sessionId, exerciseId, note) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? {
                  ...sess,
                  exerciseLogs: sess.exerciseLogs.map((el) =>
                    el.exerciseId === exerciseId ? { ...el, note } : el
                  ),
                }
              : sess
          ),
        })),

      completeSession: (sessionId) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, completed: true } : sess
          ),
          view: 'history',
          activeSessionId: null,
        })),

      deleteSession: (sessionId) =>
        set((s) => ({
          sessions: s.sessions.filter((sess) => sess.id !== sessionId),
        })),

      // ─── YouTube API Key ──────────────────────────────────────────
      youtubeApiKey: '',
      setYoutubeApiKey: (key) => set({ youtubeApiKey: key }),

      // ─── Helpers ──────────────────────────────────────────────────
      getLastSessionForDay: (splitId, dayId) => {
        const { sessions } = get()
        return sessions
          .filter((s) => s.splitId === splitId && s.dayId === dayId && s.completed)
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null
      },

      getExerciseHistory: (exerciseName) => {
        const { sessions } = get()
        const history = []
        sessions
          .filter((s) => s.completed)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .forEach((sess) => {
            const log = sess.exerciseLogs.find(
              (el) => el.exerciseName.toLowerCase() === exerciseName.toLowerCase()
            )
            if (log && log.sets.length > 0) {
              const maxWeight = Math.max(...log.sets.map((st) => parseFloat(st.weight) || 0))
              const totalVolume = log.sets.reduce(
                (sum, st) => sum + (parseFloat(st.weight) || 0) * (parseInt(st.reps) || 0),
                0
              )
              history.push({
                date: sess.date,
                maxWeight,
                totalVolume,
                sets: log.sets,
              })
            }
          })
        return history
      },

      getPersonalRecord: (exerciseName) => {
        const history = get().getExerciseHistory(exerciseName)
        if (!history.length) return null
        return Math.max(...history.map((h) => h.maxWeight))
      },
    }),
    {
      name: 'workout-app-storage',
    }
  )
)

export default useAppStore
