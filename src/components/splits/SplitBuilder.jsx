import React, { useState } from 'react'
import { ArrowLeft, Plus, Play, GripVertical, Trash2, Pencil, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useAppStore from '../../store/useAppStore'
import ExerciseItem from './ExerciseItem'

export default function SplitBuilder({ split, onBack }) {
  const { addDay, updateDay, deleteDay, reorderDays, startSession } = useAppStore()
  const liveSplit = useAppStore((s) => s.splits.find((sp) => sp.id === split.id))
  const [addingDay, setAddingDay] = useState(false)
  const [newDayName, setNewDayName] = useState('')
  const [expandedDayId, setExpandedDayId] = useState(null)
  const [editDayId, setEditDayId] = useState(null)
  const [editDayName, setEditDayName] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const days = liveSplit.days
    reorderDays(split.id, arrayMove(days, days.findIndex(d => d.id === active.id), days.findIndex(d => d.id === over.id)))
  }

  if (!liveSplit) return null

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-bg-3 text-txt-secondary hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{liveSplit.name}</h1>
          <p className="text-xs text-txt-secondary">{liveSplit.days.length} day{liveSplit.days.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setAddingDay(true)} className="flex items-center gap-1.5 bg-bg-3 text-txt-secondary px-3 py-2 rounded-xl text-sm font-semibold hover:bg-bg-4 hover:text-white transition-colors">
          <Plus size={15} /> Add Day
        </button>
      </div>

      <div className="px-4 pb-24">
        {addingDay && (
          <div className="bg-bg-2 border border-bg-4 rounded-xl p-4 mb-3">
            <p className="text-xs text-txt-secondary mb-2">Day name</p>
            <div className="flex gap-2">
              <input autoFocus value={newDayName} onChange={e => setNewDayName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { addDay(split.id, newDayName.trim()); setNewDayName(''); setAddingDay(false) } if (e.key === 'Escape') setAddingDay(false) }}
                placeholder="e.g. Push, Pull, Legs, Chest & Tris..."
                className="flex-1 bg-bg-3 rounded-lg px-3 py-2 text-sm text-white placeholder-txt-muted focus:outline-none focus:ring-1 focus:ring-accent" />
              <button onClick={() => { addDay(split.id, newDayName.trim()); setNewDayName(''); setAddingDay(false) }} className="bg-accent text-white w-9 h-9 rounded-lg flex items-center justify-center"><Check size={15} /></button>
              <button onClick={() => setAddingDay(false)} className="bg-bg-3 text-txt-muted w-9 h-9 rounded-lg flex items-center justify-center hover:text-white"><X size={15} /></button>
            </div>
          </div>
        )}

        {liveSplit.days.length === 0 && !addingDay && (
          <div className="text-center py-16">
            <p className="text-txt-secondary font-semibold">No days yet</p>
            <p className="text-txt-muted text-sm mt-1 mb-4">Add training days to build your routine</p>
            <button onClick={() => setAddingDay(true)} className="bg-accent text-white px-5 py-2.5 rounded-xl font-semibold text-sm">Add First Day</button>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={liveSplit.days.map(d => d.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {liveSplit.days.map(day => (
                <SortableDayCard key={day.id} day={day} splitId={split.id}
                  expanded={expandedDayId === day.id}
                  onToggle={() => setExpandedDayId(expandedDayId === day.id ? null : day.id)}
                  isEditing={editDayId === day.id} editName={editDayName}
                  onEditStart={() => { setEditDayId(day.id); setEditDayName(day.name) }}
                  onEditChange={setEditDayName}
                  onEditSave={() => { if (editDayName.trim()) updateDay(split.id, day.id, { name: editDayName.trim() }); setEditDayId(null) }}
                  onEditCancel={() => setEditDayId(null)}
                  onDelete={() => deleteDay(split.id, day.id)}
                  onStartWorkout={() => startSession(split.id, day.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}

function SortableDayCard({ day, splitId, expanded, onToggle, isEditing, editName, onEditStart, onEditChange, onEditSave, onEditCancel, onDelete, onStartWorkout }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="bg-bg-2 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-3">
        <button className="drag-handle p-1 text-txt-muted hover:text-txt-secondary" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </button>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <input autoFocus value={editName} onChange={e => onEditChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel() }}
                className="flex-1 bg-bg-3 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent" />
              <button onClick={onEditSave} className="text-accent"><Check size={14} /></button>
              <button onClick={onEditCancel} className="text-txt-muted hover:text-white"><X size={14} /></button>
            </div>
          ) : (
            <button className="text-left w-full" onClick={onToggle}>
              <p className="font-semibold text-white text-[15px]">{day.name}</p>
              <p className="text-xs text-txt-secondary">{day.exercises.length} exercise{day.exercises.length !== 1 ? 's' : ''}</p>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={onStartWorkout} className="bg-accent text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-accent-dark">
            <Play size={12} /> Start
          </button>
          <button onClick={onEditStart} className="p-1.5 text-txt-muted hover:text-white rounded-lg"><Pencil size={14} /></button>
          <button onClick={onDelete} className="p-1.5 text-txt-muted hover:text-danger rounded-lg"><Trash2 size={14} /></button>
          <button onClick={onToggle} className="p-1.5 text-txt-muted hover:text-white rounded-lg">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-bg-3">
          <ExerciseItem splitId={splitId} day={day} />
        </div>
      )}
    </div>
  )
}
