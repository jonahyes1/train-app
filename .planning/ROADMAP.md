# Roadmap: Workout App

## Overview

Four phases take this project from zero to a complete personal workout tracker. Phase 1 builds the visual foundation and the split builder — the structural backbone of the app. Phase 2 attaches YouTube form videos to exercises. Phase 3 implements the live workout logging session. Phase 4 closes the loop with session history and progress tracking. Each phase delivers a complete, usable capability before the next begins.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation + Splits** - App scaffold with gym-energy UI and full training split builder
- [ ] **Phase 2: Video Integration** - YouTube form video attachment, in-app playback, and search
- [ ] **Phase 3: Workout Logging** - Live session logging with rest timer, notes, RPE, and pre-fill
- [ ] **Phase 4: History + Progress** - Session history panel, exercise progress charts, and PR detection

## Phase Details

### Phase 1: Foundation + Splits
**Goal**: Users can define their entire training program in a visually polished, responsive app
**Depends on**: Nothing (first phase)
**Requirements**: SPLT-01, SPLT-02, SPLT-03, SPLT-04, SPLT-05, SPLT-06, UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. User can create a named split with multiple named training days and add exercises to each day
  2. User can reorder exercises within a day via drag-and-drop
  3. User can edit a split (rename it, add/remove/reorder days) and delete splits or individual days
  4. The app displays a dark, high-contrast gym-energy aesthetic on both mobile and desktop
**Plans**: TBD

### Phase 2: Video Integration
**Goal**: Users can attach and watch YouTube form videos for any exercise without leaving the app
**Depends on**: Phase 1
**Requirements**: VID-01, VID-02, VID-03, VID-04
**Success Criteria** (what must be TRUE):
  1. User can paste a YouTube URL onto any exercise and see a thumbnail preview appear
  2. User can search YouTube from within the app and select a video to link to an exercise
  3. User can tap the video thumbnail and watch the form video in a clean in-app modal with no tab switching
**Plans**: TBD

### Phase 3: Workout Logging
**Goal**: Users can run a complete workout session with zero friction, logging every set as they go
**Depends on**: Phase 2
**Requirements**: LOG-01, LOG-02, LOG-03, LOG-04
**Success Criteria** (what must be TRUE):
  1. User can log sets x reps x weight for each exercise during a session, with last session's numbers pre-filled
  2. User can start a countdown rest timer immediately after completing a set
  3. User can add a text note and an RPE rating to any set or exercise during the session
**Plans**: TBD

### Phase 4: History + Progress
**Goal**: Users can see where they've been — every past session and every exercise's improvement over time
**Depends on**: Phase 3
**Requirements**: HIST-01, HIST-02, HIST-03, HIST-04
**Success Criteria** (what must be TRUE):
  1. A persistent sidebar shows past workout sessions (calendar or list view) while the user is in the app
  2. User can tap any past session in the sidebar and see all logged sets and details for that session
  3. User can view a chart of weight and reps over time for any individual exercise
  4. The app highlights when a new personal record is achieved during a live logging session
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Splits | 0/TBD | Not started | - |
| 2. Video Integration | 0/TBD | Not started | - |
| 3. Workout Logging | 0/TBD | Not started | - |
| 4. History + Progress | 0/TBD | Not started | - |
