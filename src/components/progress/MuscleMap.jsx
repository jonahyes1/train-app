// src/components/progress/MuscleMap.jsx
// Anatomical muscle map with marketing-grade interaction polish.
//
// Built on react-body-highlighter (MIT licensed). The package renders
// muscle regions as <polygon> elements with inline fill colors. We:
//   1. Give each muscle group its own brand color via the frequency trick
//      (each group has a unique frequency, indexing into highlightedColors).
//   2. Add CSS transitions for smooth hover-glow and click-depression
//      feedback. CSS targets `.muscle-map svg.rbh polygon` and uses
//      filter + transform for the effects (fill stays inline-managed by
//      the package, but filter brightens/saturates it on hover and dims
//      it on active).
//
// The 3D card-flip animation around the body is preserved.

import React, { useState } from 'react'
import { RotateCw } from 'lucide-react'
import Model from 'react-body-highlighter'

// Each entry maps an app-level muscle group → the package's named muscles
// + a brand color + an explicit frequency. The frequency is the trick:
// it's the index into highlightedColors that determines the muscle's tint.
const GROUPS = [
  { name: 'Chest',         muscles: ['chest'],                                                  color: '#FF6B6B' },
  { name: 'Back',          muscles: ['upper-back', 'lower-back', 'trapezius'],                  color: '#4ECDC4' },
  { name: 'Shoulders',     muscles: ['front-deltoids', 'back-deltoids'],                        color: '#FFD93D' },
  { name: 'Biceps',        muscles: ['biceps'],                                                 color: '#A78BFA' },
  { name: 'Triceps',       muscles: ['triceps'],                                                color: '#F472B6' },
  { name: 'Forearms',      muscles: ['forearm'],                                                color: '#FB923C' },
  { name: 'Core',          muscles: ['abs', 'obliques'],                                        color: '#60A5FA' },
  { name: 'Legs',          muscles: ['quadriceps', 'hamstring', 'gluteal', 'adductor', 'abductors'], color: '#34D399' },
  { name: 'Calves/Shins',  muscles: ['calves', 'left-soleus', 'right-soleus'],                  color: '#22D3EE' },
]

// Build data with unique frequencies (1..N) so each muscle group gets a
// distinct color from highlightedColors[frequency - 1].
const DATA = GROUPS.map((g, i) => ({
  name: g.name,
  muscles: g.muscles,
  frequency: i + 1,
}))

const HIGHLIGHTED_COLORS = GROUPS.map(g => g.color)
const BODY_COLOR = '#2A2A2A'  // bg-3-ish so the silhouette has presence

// Reverse lookup: muscle name → group name
const MUSCLE_TO_GROUP = (() => {
  const m = {}
  for (const g of GROUPS) for (const muscle of g.muscles) m[muscle] = g.name
  return m
})()

// CSS shipped inline (scoped via .muscle-map prefix). Keeping it here
// avoids polluting global stylesheets and makes the effects local to
// this component.
const STYLE = `
.muscle-map svg.rbh polygon {
  cursor: pointer;
  transform-origin: center;
  transform-box: fill-box;
  transition:
    filter 220ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 160ms cubic-bezier(0.4, 0, 0.2, 1);
}
.muscle-map svg.rbh polygon:hover {
  filter:
    brightness(1.18)
    saturate(1.15)
    drop-shadow(0 0 6px rgba(255, 255, 255, 0.35));
}
.muscle-map svg.rbh polygon:active {
  filter: brightness(0.6) saturate(0.85);
  transform: scale(0.95);
  transition:
    filter 80ms ease-out,
    transform 80ms ease-out;
}
.muscle-map .flip-card {
  transition: transform 600ms cubic-bezier(0.4, 0.2, 0.2, 1);
}
`

export default function MuscleMap({ onSelectGroup }) {
  const [showBack, setShowBack] = useState(false)

  const handleMuscleClick = ({ muscle }) => {
    const group = MUSCLE_TO_GROUP[muscle]
    if (group && onSelectGroup) onSelectGroup(group)
  }

  return (
    <div className="muscle-map bg-bg-1 border border-bg-3 rounded-2xl p-4">
      <style>{STYLE}</style>

      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest text-txt-muted font-bold">
          Body Map · {showBack ? 'Back' : 'Front'}
        </p>
        <button
          onClick={() => setShowBack(b => !b)}
          className="flex items-center gap-1.5 text-[11px] bg-bg-2 hover:bg-bg-3 active:scale-95 border border-bg-3 text-white rounded-full px-2.5 py-1 font-semibold transition-transform"
          aria-label="Flip body view"
        >
          <RotateCw size={11} />
          Flip
        </button>
      </div>

      <div className="flex justify-center" style={{ perspective: '1200px' }}>
        <div
          className="flip-card relative w-full max-w-[260px] mx-auto"
          style={{
            aspectRatio: '1 / 2',
            transformStyle: 'preserve-3d',
            transform: showBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front face — anatomical anterior view */}
          <div
            className="absolute inset-0 flex justify-center"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              pointerEvents: showBack ? 'none' : 'auto',
            }}
          >
            <Model
              data={DATA}
              type="anterior"
              highlightedColors={HIGHLIGHTED_COLORS}
              bodyColor={BODY_COLOR}
              onClick={handleMuscleClick}
              style={{ width: '100%', height: '100%' }}
              svgStyle={{ height: '100%', width: '100%' }}
            />
          </div>
          {/* Back face — pre-rotated 180° so it reads correctly after flip */}
          <div
            className="absolute inset-0 flex justify-center"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              pointerEvents: showBack ? 'auto' : 'none',
            }}
          >
            <Model
              data={DATA}
              type="posterior"
              highlightedColors={HIGHLIGHTED_COLORS}
              bodyColor={BODY_COLOR}
              onClick={handleMuscleClick}
              style={{ width: '100%', height: '100%' }}
              svgStyle={{ height: '100%', width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Color legend */}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 justify-center">
        {GROUPS.map(g => (
          <div key={g.name} className="flex items-center gap-1 text-[10px] text-txt-muted">
            <span
              className="w-2 h-2 rounded-sm"
              style={{ background: g.color }}
            />
            {g.name}
          </div>
        ))}
      </div>

      <div className="text-center mt-2 h-4">
        <span className="text-[11px] text-txt-muted">Tap a muscle to drill in</span>
      </div>
    </div>
  )
}
