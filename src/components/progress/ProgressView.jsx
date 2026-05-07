// src/components/progress/ProgressView.jsx
// Three-tab dashboard:
//   1. STRENGTHS  — at-a-glance stats, top PRs, compound lifts overview
//   2. EXERCISES  — muscle group navigation → list → detail charts
//   3. IMPROVEMENT — top movers (last 30 days), volume by muscle group
//
// Charts use a soft gradient fill under the line + a dashed PR reference
// line for context. All weights in kg.

import React, { useMemo, useState } from 'react'
import {
  TrendingUp, Trophy, Search, ArrowLeft, RefreshCw, AlertCircle,
  Layers, ChevronRight, List, Dumbbell, Flame, Calendar as CalendarIcon,
  ArrowUp, ArrowDown, Minus,
} from 'lucide-react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  Cell,
} from 'recharts'
import { useSheetData } from '../../lib/useSheetData'
import { toISODate, isConfigured } from '../../lib/settings'
import { muscleGroupFor, MUSCLE_GROUP_LIST } from '../../lib/program'
import MuscleMap from './MuscleMap'

const COMPOUND_LIFTS = [
  'Bench Press', 'Back Squat', 'Romanian Deadlift',
  'Push Press', 'Weighted Pull-Ups', 'Incline Bench Press',
]

export default function ProgressView() {
  const { rows, loading, error, refresh } = useSheetData()
  const [tab, setTab] = useState('strengths') // 'strengths' | 'exercises' | 'improvement'
  const [exerciseMode, setExerciseMode] = useState('groups') // groups | list | detail | all
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [query, setQuery] = useState('')

  const byExercise = useMemo(() => buildByExercise(rows), [rows])
  const summarized = useMemo(() => {
    const list = Object.keys(byExercise).map(name => ({
      name,
      muscleGroup: muscleGroupFor(name) || 'Other',
      ...summarize(byExercise[name]),
    }))
    list.sort((a, b) => b.lastDateMs - a.lastDateMs)
    return list
  }, [byExercise])

  if (!isConfigured()) {
    return <EmptyState icon={<AlertCircle size={28} className="text-warn" />}
                       title="Not configured"
                       subtitle="Open Settings from the calendar to connect your Apps Script URL." />
  }
  if (error && !rows.length) {
    return <EmptyState icon={<AlertCircle size={28} className="text-danger" />}
                       title="Couldn't load progress"
                       subtitle={error.message}
                       action={<button onClick={refresh} className="mt-4 text-accent text-sm font-semibold">Try again</button>} />
  }
  if (!summarized.length && !loading) {
    return <EmptyState icon={<TrendingUp size={28} className="text-txt-muted" />}
                       title="No data yet"
                       subtitle="Log some workouts and progress charts will appear here." />
  }

  // Drilled-in exercise detail (used from Exercises tab)
  if (exerciseMode === 'detail' && selectedExercise) {
    return (
      <ExerciseDetail
        name={selectedExercise}
        sessions={byExercise[selectedExercise] || {}}
        onBack={() => {
          setSelectedExercise(null)
          setExerciseMode(selectedGroup ? 'list' : 'all')
        }}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 pt-5 pb-3 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-white">Progress</h1>
          <p className="text-xs text-txt-secondary mt-0.5">
            {summarized.length} exercise{summarized.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <button onClick={refresh}
                className="flex items-center gap-1 text-[11px] text-txt-muted hover:text-white px-2 py-1">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Syncing' : 'Refresh'}
        </button>
      </div>

      {/* Tab bar */}
      <div className="px-4 pb-3 flex-shrink-0">
        <div className="flex gap-1 bg-bg-1 border border-bg-3 rounded-xl p-1">
          <TabButton active={tab === 'strengths'} onClick={() => setTab('strengths')} icon={<Trophy size={13} />} label="Strengths" />
          <TabButton active={tab === 'exercises'} onClick={() => { setTab('exercises'); setExerciseMode('groups') }} icon={<Layers size={13} />} label="Exercises" />
          <TabButton active={tab === 'improvement'} onClick={() => setTab('improvement')} icon={<TrendingUp size={13} />} label="Improvement" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {tab === 'strengths' && (
          <StrengthsTab
            summarized={summarized}
            byExercise={byExercise}
            rows={rows}
            onSelectGroup={(g) => {
              setTab('exercises')
              setExerciseMode('list')
              setSelectedGroup(g)
            }}
          />
        )}
        {tab === 'exercises' && (
          <ExercisesTabRouter
            mode={exerciseMode} setMode={setExerciseMode}
            selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup}
            setSelectedExercise={setSelectedExercise}
            summarized={summarized}
            query={query} setQuery={setQuery}
          />
        )}
        {tab === 'improvement' && <ImprovementTab summarized={summarized} byExercise={byExercise} rows={rows} />}
      </div>
    </div>
  )
}

// ─── Tabs ────────────────────────────────────────────────────────

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
        active ? 'bg-accent text-white' : 'text-txt-secondary hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── 1. STRENGTHS ───────────────────────────────────────────────

function StrengthsTab({ summarized, byExercise, rows, onSelectGroup }) {
  const stats = useMemo(() => computeMonthStats(rows), [rows])
  const compounds = useMemo(() => {
    return COMPOUND_LIFTS
      .map(name => {
        const data = byExercise[name]
        if (!data) return null
        const isos = Object.keys(data).sort()
        const points = isos.map(iso => ({
          iso,
          weight: topWeightFromSets(data[iso]),
        })).filter(p => p.weight > 0)
        if (!points.length) return null
        const pr = Math.max(...points.map(p => p.weight))
        const first = points[0].weight
        const last = points[points.length - 1].weight
        return { name, points, pr, first, last, gain: last - first }
      })
      .filter(Boolean)
  }, [byExercise])

  const topPRs = useMemo(() => {
    return [...summarized]
      .filter(e => e.pr != null)
      .sort((a, b) => b.pr - a.pr)
      .slice(0, 5)
  }, [summarized])

  return (
    <div className="px-4 space-y-4">
      {/* Body map */}
      <MuscleMap onSelectGroup={onSelectGroup} />

      {/* Stats overview */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={<CalendarIcon size={14} className="text-accent-light" />} label="Sessions this month" value={stats.sessions} />
        <StatCard icon={<Dumbbell size={14} className="text-accent-light" />} label="Sets this month" value={stats.sets} />
        <StatCard icon={<Flame size={14} className="text-warn" />} label="Volume this month (kg)" value={fmtCompact(stats.volume)} />
        <StatCard icon={<Trophy size={14} className="text-warn" />} label="Top PR" value={stats.topPR ? `${stats.topPR.weight}kg` : '—'} sub={stats.topPR?.name} />
      </div>

      {/* Compound lifts */}
      {compounds.length > 0 && (
        <div>
          <SectionHeader>Big Lifts</SectionHeader>
          <div className="space-y-2">
            {compounds.map(c => (
              <div key={c.name} className="bg-bg-1 border border-bg-3 rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-semibold text-sm">{c.name}</span>
                  <div className="flex items-center gap-1.5">
                    {c.gain > 0 ? (
                      <span className="flex items-center gap-0.5 text-success text-[11px] font-bold">
                        <ArrowUp size={11} /> +{fmt(c.gain)}kg
                      </span>
                    ) : c.gain < 0 ? (
                      <span className="flex items-center gap-0.5 text-danger text-[11px] font-bold">
                        <ArrowDown size={11} /> {fmt(c.gain)}kg
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-txt-muted text-[11px]">
                        <Minus size={11} /> Same
                      </span>
                    )}
                    <span className="text-warn text-xs font-bold flex items-center gap-1">
                      <Trophy size={10} /> {fmt(c.pr)}kg
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={50}>
                  <AreaChart data={c.points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                    <defs>
                      <linearGradient id={`grad-${slug(c.name)}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F86F7" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#4F86F7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="weight" stroke="#4F86F7" strokeWidth={1.5}
                          fill={`url(#grad-${slug(c.name)})`} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top PRs */}
      <div>
        <SectionHeader>Top PRs</SectionHeader>
        <div className="space-y-1.5">
          {topPRs.map((e, i) => (
            <div key={e.name} className="flex items-center gap-3 bg-bg-1 border border-bg-3 rounded-xl px-3 py-2.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                i === 0 ? 'bg-warn/20 text-warn' : 'bg-bg-2 text-txt-secondary'
              }`}>
                #{i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{e.name}</p>
                <p className="text-[11px] text-txt-muted">{e.muscleGroup} · {e.sessionCount} session{e.sessionCount !== 1 ? 's' : ''}</p>
              </div>
              <span className="text-warn font-bold text-sm tabular-nums">{fmt(e.pr)}kg</span>
            </div>
          ))}
          {!topPRs.length && (
            <div className="text-center text-txt-muted text-xs py-6">Log at least one set to see PRs</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 2. EXERCISES (router) ──────────────────────────────────────

function ExercisesTabRouter({ mode, setMode, selectedGroup, setSelectedGroup, setSelectedExercise, summarized, query, setQuery }) {
  const groupCounts = useMemo(() => {
    const c = {}
    for (const e of summarized) c[e.muscleGroup] = (c[e.muscleGroup] || 0) + 1
    return c
  }, [summarized])

  if (mode === 'list' && selectedGroup) {
    const list = summarized.filter(e => e.muscleGroup === selectedGroup)
    return (
      <ExerciseListView
        title={selectedGroup}
        exercises={list}
        query={query}
        onQuery={setQuery}
        onBack={() => { setMode('groups'); setSelectedGroup(null); setQuery('') }}
        onSelect={(name) => { setSelectedExercise(name); setMode('detail') }}
      />
    )
  }

  if (mode === 'all') {
    return (
      <ExerciseListView
        title="All Exercises"
        exercises={summarized}
        query={query}
        onQuery={setQuery}
        onBack={() => { setMode('groups'); setQuery('') }}
        onSelect={(name) => { setSelectedExercise(name); setSelectedGroup(null); setMode('detail') }}
      />
    )
  }

  return (
    <div className="px-4 space-y-1.5">
      <button
        onClick={() => { setMode('all'); setQuery('') }}
        className="w-full flex items-center gap-2 bg-bg-1 border border-bg-3 rounded-xl px-4 py-2.5 text-left hover:border-accent/40"
      >
        <List size={14} className="text-txt-muted" />
        <span className="text-sm text-white font-medium flex-1">All Exercises</span>
        <span className="text-[11px] text-txt-muted">{summarized.length}</span>
        <ChevronRight size={14} className="text-txt-muted" />
      </button>

      {MUSCLE_GROUP_LIST.concat(['Other']).map(g => {
        const count = groupCounts[g] || 0
        if (!count) return null
        const top = summarized.filter(e => e.muscleGroup === g).slice(0, 3).map(e => e.name).join(' · ')
        return (
          <button
            key={g}
            onClick={() => { setSelectedGroup(g); setMode('list') }}
            className="w-full flex items-center gap-3 bg-bg-1 border border-bg-3 rounded-xl px-4 py-3 text-left hover:border-accent/40"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${groupColor(g)}`}>
              <Layers size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white text-[14px]">{g}</p>
              <p className="text-[11px] text-txt-muted mt-0.5 truncate">{top}</p>
            </div>
            <span className="text-[11px] text-txt-muted">{count}</span>
            <ChevronRight size={14} className="text-txt-muted" />
          </button>
        )
      })}
    </div>
  )
}

// ─── 3. IMPROVEMENT ─────────────────────────────────────────────

function ImprovementTab({ summarized, byExercise, rows }) {
  const movers = useMemo(() => computeTopMovers(byExercise, summarized), [byExercise, summarized])
  const monthlyVolumes = useMemo(() => computeMonthlyVolumeByGroup(rows), [rows])

  return (
    <div className="px-4 space-y-4">
      <div>
        <SectionHeader>Top Movers · Last 30 Days</SectionHeader>
        <div className="space-y-1.5">
          {movers.length === 0 && (
            <div className="bg-bg-1 border border-bg-3 rounded-xl p-6 text-center">
              <p className="text-txt-secondary text-sm">Need at least 2 sessions of an exercise to detect movement.</p>
            </div>
          )}
          {movers.map(m => (
            <div key={m.name} className="flex items-center gap-3 bg-bg-1 border border-bg-3 rounded-xl px-3 py-2.5">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                m.delta > 0 ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
              }`}>
                {m.delta > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{m.name}</p>
                <p className="text-[11px] text-txt-muted">
                  {fmt(m.from)}kg → {fmt(m.to)}kg
                  {m.percent != null && (m.percent > 0 || m.percent < 0)
                    ? ` (${m.percent > 0 ? '+' : ''}${m.percent.toFixed(1)}%)`
                    : ''}
                </p>
              </div>
              <span className={`font-bold text-sm tabular-nums ${m.delta > 0 ? 'text-success' : 'text-danger'}`}>
                {m.delta > 0 ? '+' : ''}{fmt(m.delta)}kg
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader>Monthly Volume by Muscle Group</SectionHeader>
        <div className="bg-bg-1 border border-bg-3 rounded-2xl p-3">
          {monthlyVolumes.length === 0 ? (
            <p className="text-txt-secondary text-sm text-center py-6">Log a few sessions and this chart fills in.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(140, monthlyVolumes.length * 26)}>
              <BarChart data={monthlyVolumes} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#272727" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#5A5A5A', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="group" type="category" width={90} tick={{ fill: '#9B9B9B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#161616', border: '1px solid #303030', borderRadius: 8, color: '#fff', fontSize: 12 }}
                  cursor={{ fill: 'rgba(79,134,247,0.05)' }}
                  formatter={(value) => [`${fmtCompact(value)} kg`, 'Volume (last 30d)']}
                />
                <Bar dataKey="volume" radius={[0, 4, 4, 0]}>
                  {monthlyVolumes.map((entry, i) => (
                    <Cell key={i} fill={hexForGroup(entry.group)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── List view (used by Exercises tab) ──────────────────────────

function ExerciseListView({ title, exercises, query, onQuery, onBack, onSelect }) {
  const filtered = query.trim()
    ? exercises.filter(e => e.name.toLowerCase().includes(query.toLowerCase()))
    : exercises

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-bg-1 border-b border-bg-3 flex-shrink-0">
        <button onClick={onBack} className="p-1 -ml-1 text-txt-secondary hover:text-white" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-txt-muted uppercase tracking-wider">Muscle group</div>
          <div className="text-white font-bold text-sm truncate">{title}</div>
        </div>
        <span className="text-[11px] text-txt-muted whitespace-nowrap">{exercises.length}</span>
      </div>

      <div className="flex-shrink-0 px-4 py-3">
        <div className="flex items-center gap-2 bg-bg-1 border border-bg-3 rounded-xl px-3 py-2.5">
          <Search size={15} className="text-txt-muted" />
          <input
            value={query}
            onChange={e => onQuery(e.target.value)}
            placeholder="Search exercises..."
            className="flex-1 bg-transparent text-sm text-white placeholder-txt-muted focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-1.5">
        {filtered.map(e => (
          <button
            key={e.name}
            onClick={() => onSelect(e.name)}
            className="w-full flex items-center justify-between bg-bg-1 border border-bg-3 rounded-xl px-4 py-3 text-left hover:border-accent/40"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white text-[14px] truncate">{e.name}</p>
              <p className="text-[11px] text-txt-muted mt-0.5">
                {e.sessionCount} session{e.sessionCount !== 1 ? 's' : ''} · last {fmtDate(e.lastDateMs)}
              </p>
            </div>
            <div className="text-right ml-3">
              {e.pr != null && (
                <div className="flex items-center gap-1 justify-end text-warn text-xs font-bold">
                  <Trophy size={11} /> {fmt(e.pr)} kg
                </div>
              )}
              {e.lastMax != null && (
                <p className="text-[11px] text-txt-muted mt-0.5">{fmt(e.lastMax)} kg last</p>
              )}
            </div>
            <ChevronRight size={14} className="text-txt-muted ml-2" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Detail (charts) ───────────────────────────────────────────

function ExerciseDetail({ name, sessions, onBack }) {
  const isoList = Object.keys(sessions).sort()
  const points = isoList.map(iso => {
    const sets = sessions[iso]
    const weights = sets.map(r => Number(r.weight_kg)).filter(n => !Number.isNaN(n))
    const reps = sets.map(r => Number(r.reps)).filter(n => !Number.isNaN(n))
    const maxWeight = weights.length ? Math.max(...weights) : 0
    const totalReps = reps.reduce((a, b) => a + b, 0)
    const volume = sets.reduce((sum, r) => sum + (Number(r.weight_kg) || 0) * (Number(r.reps) || 0), 0)
    return {
      iso,
      date: isoToShort(iso),
      weight: maxWeight,
      volume: Math.round(volume),
      sets: sets.length,
      reps: totalReps,
    }
  })

  const pr = points.length ? Math.max(...points.map(p => p.weight)) : null
  const first = points[0]?.weight || 0
  const last = points[points.length - 1]?.weight || 0
  const gain = last - first
  const pctGain = first > 0 ? (gain / first) * 100 : 0

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-bg-1 border-b border-bg-3 flex-shrink-0">
        <button onClick={onBack} className="p-1 -ml-1 text-txt-secondary hover:text-white" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-txt-muted uppercase tracking-wider">Exercise</div>
          <div className="text-white font-bold text-sm truncate">{name}</div>
        </div>
        {pr != null && (
          <div className="flex items-center gap-1 bg-warn/10 text-warn px-2.5 py-1 rounded-lg text-[11px] font-bold">
            <Trophy size={11} /> {fmt(pr)} kg
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">
        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Sessions" value={points.length} />
          <StatCard label="First → Now" value={`${fmt(first)} → ${fmt(last)}`} />
          <StatCard label="Gain" value={`${gain >= 0 ? '+' : ''}${fmt(gain)}kg`}
                    sub={pctGain ? `${pctGain >= 0 ? '+' : ''}${pctGain.toFixed(1)}%` : ''}
                    accent={gain > 0 ? 'success' : gain < 0 ? 'danger' : null} />
        </div>

        {points.length > 1 ? (
          <>
            <ChartCard title="Top weight per session (kg)"
                       data={points} dataKey="weight" stroke="#4F86F7" pr={pr} unit="kg" />
            <ChartCard title="Volume per session (kg × reps)"
                       data={points} dataKey="volume" stroke="#34C759" unit="" />
          </>
        ) : (
          <div className="bg-bg-1 border border-bg-3 rounded-2xl p-6 text-center">
            <p className="text-txt-secondary text-sm">
              Only {points.length} session so far. One more logged session and charts will appear.
            </p>
          </div>
        )}

        <div className="bg-bg-1 border border-bg-3 rounded-2xl p-4">
          <p className="text-[10px] text-txt-muted mb-3 font-semibold uppercase tracking-wider">Session History</p>
          <div className="space-y-1.5">
            {[...points].reverse().map(p => (
              <div key={p.iso} className="flex items-center justify-between py-1.5 border-b border-bg-3 last:border-0">
                <span className="text-xs text-txt-secondary">{p.date}</span>
                <span className="text-sm font-bold text-white tabular-nums">{fmt(p.weight)} kg</span>
                <span className="text-[11px] text-txt-muted">{p.sets} sets · {fmtCompact(p.volume)} vol</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ChartCard({ title, data, dataKey, stroke, pr, unit }) {
  const gradId = `chart-grad-${dataKey}`
  return (
    <div className="bg-bg-1 border border-bg-3 rounded-2xl p-4">
      <p className="text-[10px] text-txt-muted mb-3 font-semibold uppercase tracking-wider">{title}</p>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="95%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#272727" />
          <XAxis dataKey="date" tick={{ fill: '#5A5A5A', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#5A5A5A', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#161616', border: '1px solid #303030', borderRadius: 8, color: '#fff', fontSize: 12 }}
            cursor={{ stroke: '#303030' }}
            formatter={(value) => [`${value}${unit ? ' ' + unit : ''}`, title]}
          />
          {pr != null && dataKey === 'weight' && (
            <ReferenceLine y={pr} stroke="#FF9F0A" strokeDasharray="4 4" strokeOpacity={0.6}
                           label={{ value: `PR ${pr}kg`, position: 'right', fill: '#FF9F0A', fontSize: 10 }} />
          )}
          <Area type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={{ fill: stroke, r: 3 }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Visual primitives ─────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <div className="text-[10px] uppercase tracking-widest text-txt-muted font-bold mb-2 px-1">
      {children}
    </div>
  )
}

function StatCard({ icon, label, value, sub, accent }) {
  const accentClass = accent === 'success' ? 'text-success' : accent === 'danger' ? 'text-danger' : 'text-white'
  return (
    <div className="bg-bg-1 border border-bg-3 rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-txt-muted uppercase tracking-wider mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`font-bold text-base tabular-nums ${accentClass}`}>{value}</div>
      {sub && <div className="text-[11px] text-txt-muted mt-0.5 truncate">{sub}</div>}
    </div>
  )
}

function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-20 h-20 bg-bg-1 border border-bg-3 rounded-full flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-white font-semibold text-lg">{title}</p>
      {subtitle && <p className="text-txt-secondary text-sm mt-1 max-w-xs">{subtitle}</p>}
      {action}
    </div>
  )
}

// ─── Data ──────────────────────────────────────────────────────

function buildByExercise(rows) {
  const out = {}
  for (const r of rows) {
    if (!r.exercise || !r.date) continue
    const iso = toISODate(new Date(r.date))
    ;(out[r.exercise] ||= {})
    ;(out[r.exercise][iso] ||= []).push(r)
  }
  return out
}

function summarize(sessionsObj) {
  const isoList = Object.keys(sessionsObj).sort()
  const sessionCount = isoList.length
  if (!sessionCount) return { pr: null, lastMax: null, lastDateMs: 0, sessionCount: 0 }
  let pr = 0
  for (const iso of isoList) {
    for (const r of sessionsObj[iso]) {
      const w = Number(r.weight_kg)
      if (!Number.isNaN(w) && w > pr) pr = w
    }
  }
  const lastIso = isoList[isoList.length - 1]
  const lastWeights = sessionsObj[lastIso].map(r => Number(r.weight_kg)).filter(n => !Number.isNaN(n))
  const lastMax = lastWeights.length ? Math.max(...lastWeights) : null
  const [y, m, d] = lastIso.split('-').map(Number)
  return {
    pr: pr || null,
    lastMax,
    lastDateMs: new Date(y, m - 1, d).getTime(),
    sessionCount,
  }
}

function topWeightFromSets(sets) {
  let m = 0
  for (const s of sets) {
    const w = Number(s.weight_kg) || 0
    if (w > m) m = w
  }
  return m
}

function computeMonthStats(rows) {
  const cutoff = Date.now() - 30 * 86_400_000
  const inWindow = rows.filter(r => {
    if (!r.date) return false
    const t = new Date(r.date).getTime()
    return !Number.isNaN(t) && t >= cutoff
  })
  const sessions = new Set(inWindow.map(r => toISODate(new Date(r.date)))).size
  const sets = inWindow.length
  const volume = inWindow.reduce((sum, r) => sum + (Number(r.weight_kg) || 0) * (Number(r.reps) || 0), 0)
  let topPR = null
  for (const r of rows) {
    const w = Number(r.weight_kg)
    if (!Number.isNaN(w) && (!topPR || w > topPR.weight)) topPR = { weight: w, name: r.exercise }
  }
  return { sessions, sets, volume: Math.round(volume), topPR }
}

function computeTopMovers(byExercise, summarized) {
  const cutoff = Date.now() - 30 * 86_400_000
  const out = []
  for (const ex of summarized) {
    const data = byExercise[ex.name] || {}
    const isos = Object.keys(data).filter(iso => {
      const [y, m, d] = iso.split('-').map(Number)
      return new Date(y, m - 1, d).getTime() >= cutoff
    }).sort()
    if (isos.length < 2) continue
    const fromW = topWeightFromSets(data[isos[0]])
    const toW = topWeightFromSets(data[isos[isos.length - 1]])
    if (!fromW) continue
    const delta = toW - fromW
    if (Math.abs(delta) < 0.25) continue
    out.push({
      name: ex.name,
      from: fromW,
      to: toW,
      delta,
      percent: fromW > 0 ? (delta / fromW) * 100 : null,
    })
  }
  out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return out.slice(0, 5)
}

function computeMonthlyVolumeByGroup(rows) {
  const cutoff = Date.now() - 30 * 86_400_000
  const out = {}
  for (const r of rows) {
    if (!r.date) continue
    const t = new Date(r.date).getTime()
    if (Number.isNaN(t) || t < cutoff) continue
    const w = Number(r.weight_kg) || 0
    const reps = Number(r.reps) || 0
    if (!w || !reps) continue
    const g = muscleGroupFor(r.exercise) || 'Other'
    out[g] = (out[g] || 0) + w * reps
  }
  return Object.entries(out)
    .map(([group, volume]) => ({ group, volume: Math.round(volume) }))
    .sort((a, b) => b.volume - a.volume)
}

function fmtDate(ms) {
  if (!ms) return '—'
  const d = new Date(ms)
  const today = new Date(); today.setHours(0,0,0,0)
  const diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 7) return `${diff}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function isoToShort(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fmt(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function fmtCompact(v) {
  const n = Number(v) || 0
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 10_000) return Math.round(n / 1_000) + 'k'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(Math.round(n))
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function groupColor(g) {
  switch (g) {
    case 'Chest':         return 'bg-accent/15 text-accent-light'
    case 'Back':          return 'bg-success/15 text-success'
    case 'Shoulders':     return 'bg-warn/15 text-warn'
    case 'Biceps':        return 'bg-accent/15 text-accent-light'
    case 'Triceps':       return 'bg-success/15 text-success'
    case 'Forearms':      return 'bg-warn/15 text-warn'
    case 'Legs':          return 'bg-success/15 text-success'
    case 'Calves/Shins':  return 'bg-success/15 text-success'
    case 'Core':          return 'bg-accent/15 text-accent-light'
    case 'Conditioning':  return 'bg-warn/15 text-warn'
    default:              return 'bg-bg-2 text-txt-secondary'
  }
}

function hexForGroup(g) {
  switch (g) {
    case 'Chest': case 'Biceps': case 'Core':                     return '#4F86F7'
    case 'Back': case 'Triceps': case 'Legs': case 'Calves/Shins': return '#34C759'
    case 'Shoulders': case 'Forearms': case 'Conditioning':        return '#FF9F0A'
    default:                                                        return '#5A5A5A'
  }
}
