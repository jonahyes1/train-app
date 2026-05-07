import React, { useState } from 'react'
import { Plus, ChevronRight, Trash2, Pencil, Check, X, Play } from 'lucide-react'
import useAppStore from '../../store/useAppStore'

export default function SplitList({ onSelect }) {
  const { splits, createSplit, updateSplit, deleteSplit } = useAppStore()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const handleCreate = () => {
    if (!newName.trim()) return
    createSplit(newName.trim())
    setNewName('')
    setCreating(false)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Page header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Routines</h1>
        <button
          onClick={() => setCreating(true)}
          className="w-8 h-8 bg-accent rounded-full flex items-center justify-center hover:bg-accent-dark transition-colors"
        >
          <Plus size={18} className="text-white" />
        </button>
      </div>

      {creating && (
        <div className="mx-4 mb-3 bg-bg-2 border border-bg-4 rounded-xl p-4">
          <p className="text-xs text-txt-secondary mb-2">Routine name</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
              placeholder="e.g. Push Pull Legs"
              className="flex-1 bg-bg-3 rounded-lg px-3 py-2 text-sm text-white placeholder-txt-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button onClick={handleCreate} className="bg-accent text-white w-9 h-9 rounded-lg flex items-center justify-center">
              <Check size={16} />
            </button>
            <button onClick={() => setCreating(false)} className="bg-bg-3 text-txt-secondary w-9 h-9 rounded-lg flex items-center justify-center hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {splits.length === 0 && !creating ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <div className="w-20 h-20 bg-bg-2 rounded-full flex items-center justify-center mb-4">
            <Plus size={28} className="text-txt-muted" />
          </div>
          <p className="text-white font-semibold text-lg">No routines yet</p>
          <p className="text-txt-secondary text-sm mt-1 mb-6">Create a routine to organize your workouts</p>
          <button onClick={() => setCreating(true)} className="bg-accent text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-accent-dark transition-colors">
            Create Routine
          </button>
        </div>
      ) : (
        <div className="px-4 pb-6 space-y-2">
          {splits.map((split) => (
            <div key={split.id} className="bg-bg-2 rounded-xl overflow-hidden">
              {editId === split.id ? (
                <div className="flex items-center gap-2 p-4">
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { updateSplit(split.id, { name: editName.trim() }); setEditId(null) }
                      if (e.key === 'Escape') setEditId(null)
                    }}
                    className="flex-1 bg-bg-3 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <button onClick={() => { updateSplit(split.id, { name: editName.trim() }); setEditId(null) }} className="text-accent"><Check size={16} /></button>
                  <button onClick={() => setEditId(null)} className="text-txt-muted hover:text-white"><X size={16} /></button>
                </div>
              ) : (
                <button className="w-full text-left p-4 flex items-center gap-3" onClick={() => onSelect(split)}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-[15px]">{split.name}</p>
                    <p className="text-xs text-txt-secondary mt-0.5">
                      {split.days.length} day{split.days.length !== 1 ? 's' : ''} ·{' '}
                      {split.days.reduce((s, d) => s + d.exercises.length, 0)} exercises
                    </p>
                    {split.days.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {split.days.map((d) => (
                          <span key={d.id} className="text-[11px] bg-bg-4 text-txt-secondary px-2 py-0.5 rounded-full">{d.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditId(split.id); setEditName(split.name) }}
                      className="p-2 text-txt-muted hover:text-white rounded-lg"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSplit(split.id) }}
                      className="p-2 text-txt-muted hover:text-danger rounded-lg"
                    >
                      <Trash2 size={15} />
                    </button>
                    <ChevronRight size={18} className="text-txt-muted" />
                  </div>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
