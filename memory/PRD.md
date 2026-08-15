# Kuvira Sports — Product Requirements Document

## Original Problem Statement
Build Kuvira Sports — a premium, technology-first, AI-powered sports ecosystem (pickleball-first, multi-sport architecture). Should feel like District × Strava × Nike ecosystem × AI Coach. Help users Discover → Play → Connect → Train → Compete → Analyze → Improve → Buy.

## Architecture
- **Frontend**: React Native (Expo Router, SDK 54), dark obsidian + gold design system, expo-image, expo-linear-gradient, reanimated.
- **Backend**: FastAPI + MongoDB (motor). JWT auth. Modular routes under `/api`.
- **AI**: Claude Sonnet 4.6 via emergentintegrations (Emergent LLM key). Rule-based Player Match Engine, Equipment Intelligence, Performance Insights — all architected to swap for ML later.
- **Payments**: Mock PayU stub (abstracted so real PayU wires in without UI changes).
- **Auth**: Mobile + OTP (mock: any number, OTP `123456`).

## User Personas
1. **Recreational Player** — wants to find courts, games, and players nearby.
2. **Competitive Player** — trains with AI Coach, tracks performance, joins tournaments.
3. **New Player** — onboards, discovers the sport, buys first paddle via recommendations.

## Core Requirements (static)
- Personalized home feed, discovery, open games, player matching, court booking, community, marketplace, AI coach, profile/performance.
- Multi-sport data model (sports as first-class configurable entities).
- Every screen: real state, navigation, loading/empty/error/success states.

## Implemented (2026-08-15)
- **Auth & Onboarding**: Mobile+OTP login, 4-step onboarding (name/city, skill, frequency+mode, goals), JWT session.
- **Home**: Cinematic hero, quick actions, AI insight card, nearby courts rail, recommended players (with match %), upcoming events, gear picks. Pull-to-refresh.
- **Discover**: Search + category chips (Courts/Events/Tournaments/Coaches), rich cards, tournament registration.
- **Play**: Open games (skill filter chips), player list (match scores), my bookings, create game, game detail + join.
- **Court Booking**: Facility detail → date → court → slot → Confirm & Pay (mock) → confirmation.
- **Community**: Feed, create post, like toggle (optimistic).
- **Marketplace**: Product grid, category chips, "picked for your play style" rail, product detail with AI fit + specs, cart, checkout → order confirmed.
- **AI Coach**: Chat with Claude Sonnet 4.6, suggestion chips, persisted history, profile-aware system prompt.
- **Profile**: Sports identity, performance dashboard (chart + strongest/improve/AI reco), menu, sign out.
- **Backend**: Full REST API (auth, sports, facilities, availability, bookings, games, players+matching, coaches, events, tournaments, community, products+reco, cart, orders, AI coach/insights/recommendations, search) + auto-seeder.

## Testing
- Backend: 30/30 pytest passed. Frontend: all E2E flows passed (login→onboarding→tabs, booking, marketplace checkout, AI coach chat, community, game join).

## Backlog
### P1 — Sports ecosystem
- Coach booking flow + sessions, Clubs, richer Events detail/registration, Rankings/Leaderboards, Match history entry, Achievements/badges, Chat (1:1, game, club).
### P2 — Intelligence
- Training plan builder UI (persist AI plans), deeper performance analytics, equipment compare screen, advanced weighted personalization.
### P3 — Advanced
- Camera/CV pipeline (video ingestion → shot classification → metrics), Experience Center membership, automated scoring, ML recommendations, real PayU + real SMS OTP, push notifications.

## Next Tasks
- Coach booking + Clubs (P1), Training plan persistence (P2).
