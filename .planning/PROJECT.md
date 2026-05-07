# Workout App

## What This Is

A personal workout tracking app that replaces Excel with a modern, gym-energy interface. The user builds custom training splits, attaches YouTube form videos to each exercise, and logs sets/reps/weight during workouts — all in one place, on any device.

## Core Value

Every exercise has a form video one tap away, and every set logged without friction — so the user can focus on training, not managing spreadsheets.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can create and manage custom workout splits (any structure — PPL, bro split, etc.)
- [ ] User can add exercises to each split day with a linked YouTube form video
- [ ] User can search YouTube from within the app and paste links for form videos
- [ ] Form videos open in a clean, easy-to-read popup/modal inside the app
- [ ] User can log sets × reps × weight for each exercise during a workout
- [ ] User can set a rest timer between sets
- [ ] User can add notes and RPE rating per set or exercise
- [ ] User can view progress over time (weight and reps history per exercise)
- [ ] Persistent workout history panel on the side — calendar or list of past sessions visible while using the app
- [ ] App works great on both mobile and desktop (responsive)
- [ ] Dark mode, gym-energy aesthetic throughout (Nike Training / Whoop vibe)

### Out of Scope

- Social features (sharing, following, community) — personal tool, not a platform
- Native iOS/Android app — web app first
- Pre-built programs (5/3/1, PHUL, etc.) — user builds their own splits
- AI-generated workout plans — not the ask

## Context

- Currently tracking workouts in Excel; pain points are: no video access alongside exercises, poor mobile experience, tedious data entry mid-workout
- This is a personal tool — no multi-user, no auth complexity needed initially
- YouTube is the primary video source — embed + in-app search needed
- UI inspiration: Nike Training Club, Whoop — dark, bold, high-contrast, purposeful

## Constraints

- **Platform**: Web app (responsive — mobile-first but desktop-capable)
- **User**: Single user (personal tool — no accounts/auth required initially)
- **Videos**: YouTube only for v1 — embed and search via YouTube API or oEmbed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app over native mobile | Faster to build, works on all devices without App Store | — Pending |
| YouTube for videos | User already uses YouTube for form reference | — Pending |
| No auth for v1 | Personal tool — adds complexity without value | — Pending |

---
*Last updated: 2026-02-22 after initialization*
