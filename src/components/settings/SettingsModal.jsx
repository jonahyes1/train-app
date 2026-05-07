import React, { useState, useEffect } from 'react'
import { X, Save, CheckCircle2, AlertCircle, Trash2, Loader2, Activity, Heart } from 'lucide-react'
import {
  getSettings, setSettings, setActivePhase, setPatternEntry,
} from '../../lib/settings'
import { jsonp, cleanDuplicates } from '../../lib/sheets'
import { workoutTypesInPhase } from '../../lib/program'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function SettingsModal({ open, onClose }) {
  const [url, setUrl] = useState('')
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState('original')
  const [pattern, setPattern] = useState({})
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState(null)

  useEffect(() => {
    if (open) {
      const s = getSettings()
      setUrl(s.appsScriptUrl || '')
      setPassword(s.password || '')
      setPhase(s.activePhase || 'original')
      setPattern({ ...s.patterns[s.activePhase || 'original'] })
      setTestResult(null)
      setCleanResult(null)
    }
  }, [open])

  if (!open) return null

  const save = () => {
    setSettings({ appsScriptUrl: url.trim(), password: password.trim() })
    onClose?.()
  }

  const handlePhaseChange = (next) => {
    if (next === phase) return
    if (!confirm(
      next === 'until-recovery'
        ? 'Switch to "Until Recovery" phase? Your weekly pattern will change to recovery workouts. All historical data is preserved.'
        : 'Switch back to "Original" phase? Your weekly pattern will return to the standard split.'
    )) return
    const updated = setActivePhase(next)
    setPhase(next)
    setPattern({ ...updated.patterns[next] })
  }

  const handlePatternChange = (weekday, workoutType) => {
    setPatternEntry(phase, weekday, workoutType)
    setPattern(p => ({ ...p, [weekday]: workoutType }))
  }

  const handleClean = async () => {
    if (!confirm('Delete duplicate rows from your Google Sheet?\n\nKeeps the most recent version of every (date, exercise, set) entry. Older copies are removed permanently. This is safe and recommended.')) return
    setCleaning(true)
    setCleanResult(null)
    try {
      const res = await cleanDuplicates()
      setCleanResult({ ok: true, deleted: res.deleted ?? 0, kept: res.kept ?? 0 })
      try { localStorage.removeItem('trainapp:sheet-cache:v2') } catch {}
      window.dispatchEvent(new CustomEvent('settings-changed'))
    } catch (e) {
      setCleanResult({ error: e.message })
    } finally {
      setCleaning(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await jsonp(url.trim(), {})
      if (Array.isArray(res)) setTestResult({ ok: true, count: res.length })
      else if (res && res.ok) setTestResult({ ok: true, count: (res.rows || []).length })
      else if (res && res.ok === false) setTestResult({ error: res.error || 'Server returned error' })
      else setTestResult({ error: 'Unexpected response: ' + JSON.stringify(res).slice(0, 120) })
    } catch (e) {
      setTestResult({ error: e.message })
    } finally {
      setTesting(false)
    }
  }

  const choices = workoutTypesInPhase(phase)

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-bg-1 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-bg-3 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-3">
          <h2 className="text-lg font-bold text-white">Settings</h2>
          <button onClick={onClose} className="p-1 text-txt-muted hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* ─── PHASE ─────────────────────────────── */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-txt-muted mb-2">
              Active Phase
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PhaseButton
                active={phase === 'original'}
                icon={<Activity size={14} />}
                label="Original"
                sublabel="Full 4-day split"
                onClick={() => handlePhaseChange('original')}
              />
              <PhaseButton
                active={phase === 'until-recovery'}
                icon={<Heart size={14} />}
                label="Until Recovery"
                sublabel="No lower-body load"
                onClick={() => handlePhaseChange('until-recovery')}
              />
            </div>
            <p className="text-[11px] text-txt-muted mt-2 leading-snug">
              Switching is logged with today's date. All historical data is preserved either way.
            </p>
          </div>

          {/* ─── PATTERN ───────────────────────────── */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-txt-muted mb-2">
              Weekly Pattern · {phase === 'original' ? 'Original' : 'Until Recovery'}
            </div>
            <div className="space-y-1.5">
              {WEEKDAYS.map((wd, i) => (
                <div key={wd} className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-txt-secondary w-9">{wd}</span>
                  <select
                    value={pattern[i] || 'Rest'}
                    onChange={e => handlePatternChange(i, e.target.value)}
                    className="flex-1 bg-bg-2 text-white text-sm rounded-md px-2 py-2 border border-bg-3 focus:border-accent focus:outline-none"
                  >
                    {choices.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-txt-muted mt-1.5 leading-snug">
              Edits only affect this phase's pattern. Per-day overrides on the calendar still win.
            </p>
          </div>

          {/* ─── CONNECTION ────────────────────────── */}
          <div className="pt-2 border-t border-bg-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-txt-muted mb-2">
              Connection
            </div>
            <label className="block text-[11px] font-semibold text-txt-secondary mb-1 tracking-wide">
              Apps Script URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full bg-bg-2 text-white text-sm rounded-lg px-3 py-2.5 border border-bg-3 focus:border-accent focus:outline-none"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
            />

            <label className="block text-[11px] font-semibold text-txt-secondary mb-1 mt-3 tracking-wide">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Matches SHEET_PASSWORD in Code.gs"
              className="w-full bg-bg-2 text-white text-sm rounded-lg px-3 py-2.5 border border-bg-3 focus:border-accent focus:outline-none"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
            />

            <button
              onClick={test}
              disabled={!url || testing}
              className="w-full bg-bg-2 hover:bg-bg-3 disabled:opacity-40 text-white text-sm font-semibold rounded-lg py-2.5 border border-bg-3 mt-3"
            >
              {testing ? 'Testing…' : 'Test connection'}
            </button>

            {testResult?.ok && (
              <div className="flex items-start gap-2 bg-success/10 border border-success/30 rounded-lg px-3 py-2.5 text-success text-sm mt-2">
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                <span>Connected. Sheet has {testResult.count} rows.</span>
              </div>
            )}
            {testResult?.error && (
              <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg px-3 py-2.5 text-danger text-sm mt-2">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span className="break-all">{testResult.error}</span>
              </div>
            )}
          </div>

          {/* ─── MAINTENANCE ───────────────────────── */}
          <div className="pt-2 border-t border-bg-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-txt-muted mb-2">
              Maintenance
            </div>
            <button
              onClick={handleClean}
              disabled={!url || !password || cleaning}
              className="w-full bg-bg-2 hover:bg-bg-3 disabled:opacity-40 text-white text-sm font-semibold rounded-lg py-2.5 border border-bg-3 flex items-center justify-center gap-2"
            >
              {cleaning ? (
                <><Loader2 size={14} className="animate-spin" /> Cleaning…</>
              ) : (
                <><Trash2 size={14} /> Clean duplicate rows</>
              )}
            </button>
            <p className="text-[11px] text-txt-muted mt-1.5 leading-snug">
              Removes leftover duplicate rows from your sheet (kept the latest version of each set). Safe to run any time.
            </p>

            {cleanResult?.ok && (
              <div className="flex items-start gap-2 bg-success/10 border border-success/30 rounded-lg px-3 py-2.5 text-success text-sm mt-2">
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                <span>Cleaned {cleanResult.deleted} duplicate rows. {cleanResult.kept} unique sets kept.</span>
              </div>
            )}
            {cleanResult?.error && (
              <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg px-3 py-2.5 text-danger text-sm mt-2">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span className="break-all">{cleanResult.error}</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-bg-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-bg-2 hover:bg-bg-3 text-white text-sm font-semibold rounded-lg py-2.5"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!url || !password}
            className="flex-1 bg-accent hover:bg-accent-dark disabled:opacity-40 text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-1.5"
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function PhaseButton({ active, icon, label, sublabel, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
        active
          ? 'bg-accent/15 border-accent text-white'
          : 'bg-bg-2 border-bg-3 text-txt-secondary hover:text-white'
      }`}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-sm font-bold">{label}</span>
      </div>
      <div className="text-[10px] text-txt-muted mt-0.5">{sublabel}</div>
    </button>
  )
}
