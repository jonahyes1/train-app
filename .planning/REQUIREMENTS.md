# Requirements: Workout App

**Defined:** 2026-02-22
**Core Value:** Every exercise has a form video one tap away, and every set logged without friction — so the user can focus on training, not managing spreadsheets.

## v1 Requirements

### Splits

- [ ] **SPLT-01**: User can create a custom split with a name and any number of training days
- [ ] **SPLT-02**: User can name each day within a split (e.g., "Push Day", "Leg Day")
- [ ] **SPLT-03**: User can add exercises to each split day by name
- [ ] **SPLT-04**: User can reorder exercises within a day via drag-and-drop
- [ ] **SPLT-05**: User can edit a split (rename, add/remove days, reorder days)
- [ ] **SPLT-06**: User can delete a split or individual day

### Videos

- [ ] **VID-01**: User can paste a YouTube URL to link a form video to any exercise
- [ ] **VID-02**: User can watch a linked form video in a clean in-app popup/modal (no tab switching)
- [ ] **VID-03**: User can search YouTube from within the app to find form videos for an exercise
- [ ] **VID-04**: Exercise shows a video thumbnail preview for any linked video

### Logging

- [ ] **LOG-01**: User can log sets × reps × weight per exercise during a workout session
- [ ] **LOG-02**: User can start a rest timer after completing a set
- [ ] **LOG-03**: User can add notes and RPE rating per set or exercise
- [ ] **LOG-04**: App pre-fills last session's numbers for each exercise as a starting point

### History

- [ ] **HIST-01**: User can see a persistent sidebar panel showing past workout sessions (calendar or list)
- [ ] **HIST-02**: User can tap any past session to view all logged sets and details
- [ ] **HIST-03**: User can view a per-exercise history chart showing weight/reps trend over time
- [ ] **HIST-04**: App highlights personal records (PRs) when a new best is achieved

### UI / UX

- [ ] **UI-01**: App has a dark mode, gym-energy aesthetic throughout (Nike Training / Whoop style)
- [ ] **UI-02**: App is fully responsive — optimized for mobile and desktop

## v2 Requirements

### Notifications

- **NOTF-01**: Push notification when rest timer ends (browser notification)
- **NOTF-02**: Weekly summary — volume trends, PRs hit this week

### Advanced Stats

- **STAT-01**: Volume per muscle group per week (avoid overtraining)
- **STAT-02**: Estimated 1RM calculator from logged sets

### Data

- **DATA-01**: Export workout history to CSV
- **DATA-02**: Import from Excel/CSV to migrate existing data

## Out of Scope

| Feature | Reason |
|---------|--------|
| Social / sharing | Personal tool — no platform needed |
| Native iOS/Android app | Web app first |
| Pre-built programs | User builds their own splits |
| AI workout generation | Not requested |
| Multi-user / accounts | Personal tool |
| Non-YouTube video sources | YouTube covers the use case for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SPLT-01 | Phase 1 | Pending |
| SPLT-02 | Phase 1 | Pending |
| SPLT-03 | Phase 1 | Pending |
| SPLT-04 | Phase 1 | Pending |
| SPLT-05 | Phase 1 | Pending |
| SPLT-06 | Phase 1 | Pending |
| VID-01 | Phase 2 | Pending |
| VID-02 | Phase 2 | Pending |
| VID-03 | Phase 2 | Pending |
| VID-04 | Phase 2 | Pending |
| LOG-01 | Phase 3 | Pending |
| LOG-02 | Phase 3 | Pending |
| LOG-03 | Phase 3 | Pending |
| LOG-04 | Phase 3 | Pending |
| HIST-01 | Phase 4 | Pending |
| HIST-02 | Phase 4 | Pending |
| HIST-03 | Phase 4 | Pending |
| HIST-04 | Phase 4 | Pending |
| UI-01 | Phase 1 | Pending |
| UI-02 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 after roadmap creation*
