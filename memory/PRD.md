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

## Update 2026-06 — Preview wiring + role dashboards verified
- Migrated the full Kuvira codebase from GitHub (srivastavakush/kuvira_app) into the Emergent workspace, preserving protected env vars and the icon-prewarm hook.
- Added an env-driven auth provider (`frontend/src/auth-provider.ts`): `EXPO_PUBLIC_AUTH_MODE=mock` (default, preview/Expo Go/web — backend OTP `123456`) vs `firebase` (production, native build). The Firebase phone-auth code (client `signInWithPhoneNumber` + Firebase Admin server-side ID-token verify) is intact and switched purely via `.env` (`EXPO_PUBLIC_AUTH_MODE=firebase` + backend `OTP_PROVIDER=firebase`).
- Configured backend `.env`: APP_ENV, JWT_SECRET, OTP_PROVIDER=mock, PLATFORM_ADMIN_MOBILES=+919999999999, EMERGENT_LLM_KEY, CORS.
- Verified end-to-end (46/46 backend pytest + web E2E): mock OTP login/onboarding, platform-admin dashboard (create club, assign owner, facility CRUD), club owner/manager/staff workspace (analytics, bookings, members, staff mgmt, ownership transfer), org isolation 403s, court booking (+409 slot conflict), create/join game (+409 full), community posts/likes, marketplace cart/checkout, AI Coach chat (Claude via Emergent key), rankings/achievements/referrals.

## Production readiness (only .env secrets needed)
- To go live with real SMS: set backend `OTP_PROVIDER=firebase` + Firebase Admin credentials (ADC on Cloud Run or `GOOGLE_APPLICATION_CREDENTIALS`), frontend `EXPO_PUBLIC_AUTH_MODE=firebase`, add `google-services.json`/`GoogleService-Info.plist`, and generate a native build (Firebase phone auth does NOT work in Expo Go).
- Advanced AI-Coach video analysis (`/api/ai-coach/*`) needs `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`, models) — the simple AI Coach chat works today on the Emergent key.
- Set `APP_ENV=production`, real `JWT_SECRET`, explicit `CORS_ALLOWED_ORIGINS`, MongoDB Atlas `MONGO_URL` at deploy.

## Update 2026-06 (b) — Persistence bug fix + no-stock-data
- Root cause of "asks all details every login": tokens were invalidated across restarts (no stable JWT_SECRET) and DB was shared/ephemeral. Fixed with a stable `JWT_SECRET` + dedicated `kuvira_db`.
- Added `normalize_mobile()` on `/api/auth/otp/start` + `/verify` (and org owner/staff invite) so a number entered as `9998887766` or `+919998887766` always maps to ONE account → returning users are fetched from DB and skip onboarding. Verified: 2nd login returns `onboarded=true` with saved name/city/skill.
- Removed ALL fabricated/stock data: onboarding no longer injects an `i.pravatar.cc` avatar (avatar stays null unless user provides one); `/api/ai/insights` returns real per-user counts (0 for new users) with null qualitative fields instead of a hardcoded 74/62/chart; Profile renders an initials avatar (no stock face) and hides the performance chart until real AI-Coach analysis exists. One-time migration nulled legacy pravatar avatars on existing users.
- In production (`APP_ENV=production`) demo seeding is skipped, so the app launches with zero fake users/posts; operators add clubs/facilities via the admin dashboard.
- Verified: 58/58 backend pytest + full web E2E (login → onboarding → home → sign out → same-number re-login skips onboarding).
