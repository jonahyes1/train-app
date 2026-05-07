import React, { useState } from 'react'
import { Plus, Trash2, GripVertical, Check, X, Video, Search } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useAppStore from '../../store/useAppStore'
import VideoModal from '../video/VideoModal'
import { extractVideoId, getThumbnailUrl } from '../../utils/youtube'

export default function ExerciseItem({ splitId, day }) {
  const { addExercise, deleteExercise, updateExercise, reorderExercises } = useAppStore()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [videoModal, setVideoModal] = useState(null) // exerciseId

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const exs = day.exercises
    reorderExercises(splitId, day.id, arrayMove(exs, exs.findIndex(e => e.id === active.id), exs.findIndex(e => e.id === over.id)))
  }

  const handleAdd = () => {
    if (!newName.trim()) return
    addExercise(splitId, day.id, newName.trim())
    setNewName('')
  }

  return (
    <div className="px-3 py-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={day.exercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5 mb-3">
            {day.exercises.map(ex => (
              <SortableExerciseRow key={ex.id} exercise={ex}
                onDelete={() => deleteExercise(splitId, day.id, ex.id)}
                onVideoClick={() => setVideoModal(ex.id)}
                onVideoSave={(url, id, title) => updateExercise(splitId, day.id, ex.id, { videoUrl: url, videoId: id, videoTitle: title })}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {adding ? (
        <div className="flex gap-2">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
            placeholder="Exercise name"
            className="flex-1 bg-bg-3 rounded-lg px-3 py-2 text-sm text-white placeholder-txt-muted focus:outline-none focus:ring-1 focus:ring-accent" />
          <button onClick={handleAdd} className="bg-accent text-white w-9 h-9 rounded-lg flex items-center justify-center"><Check size={15} /></button>
          <button onClick={() => setAdding(false)} className="bg-bg-3 text-txt-muted w-9 h-9 rounded-lg flex items-center justify-center hover:text-white"><X size={15} /></button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 text-accent text-sm font-semibold hover:text-accent-light transition-colors py-1">
          <Plus size={15} /> Add exercise
        </button>
      )}

      {videoModal && (
        <VideoModal
          exercise={day.exercises.find(e => e.id === videoModal)}
          onSave={(url, id, title) => { updateExercise(splitId, day.id, videoModal, { videoUrl: url, videoId: id, videoTitle: title }); setVideoModal(null) }}
          onClose={() => setVideoModal(null)}
        />
      )}
    </div>
  )
}

function SortableExerciseRow({ exercise, onDelete, onVideoClick, onVideoSave }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exercise.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const thumb = exercise.videoId ? getThumbnailUrl(exercise.videoId) : null

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-bg-3 rounded-xl px-3 py-2.5 group">
      <button className="drag-handle text-txt-muted hover:text-txt-secondary" {...attributes} {...listeners}>
        <GripVertical size={15} />
      </button>

      {thumb ? (
        <button onClick={onVideoClick} className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-accent/40 hover:ring-accent">
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        </button>
      ) : (
        <button onClick={onVideoClick} className="w-8 h-8 rounded-lg bg-bg-4 flex items-center justify-center flex-shrink-0 hover:bg-bg-5 transition-colors text-txt-muted hover:text-accent">
          <Video size={14} />
        </button>
      )}

      <span className="flex-1 text-sm text-white font-medium truncate">{exercise.name}</span>

      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 p-1 text-txt-muted hover:text-danger transition-all">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
