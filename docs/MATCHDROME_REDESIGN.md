# MatchDrome redesign

The redesign preserves the Expo application, MongoDB collections, application identifiers, authentication providers, organisation roles and payment backend. The original application scheme remains registered alongside `matchdrome`; existing installed-app and authentication identities remain valid.

## Delivered

- Shared MatchDrome wordmark, application icons, light surfaces, ink typography, bright sport accents, accessible button states, 44-point controls, skeletons and retry banners.
- A responsive home feed with courts, events, real player profiles, games, tournaments, club discovery, gear and multi-sport coaching. Fabricated distances, availability, player counts, sports and win rates have been removed.
- Home, Explore, Create / Play, Chat and Activity navigation, with profile access in the home header. Explore supports player searches and sport/category links.
- Login and OTP in a dismissible sheet over the current route. Pending protected actions resume once; cancelling clears them. Temporary network errors retain valid session tokens.
- Account-scoped favourites on the current device, with a saved-courts screen. These are labelled as device-local and do not pretend to sync to a server.
- Real delivery-address collection, existing PayU checkout handling for orders and tournaments, verified payment confirmation and pending-payment rechecks. Booking, game creation, community posting and likes, shopping and coaching actions are gated.
- Multi-sport selection in coaching, games and management forms. AI uploads collect level and goal, retain completed upload stages for retry, and show measured upload progress. Browser uploads use multipart FormData; native uploads retain Expo’s native uploader. Both use the same existing backend routes and field names.
- Player-photo optimistic preview, measured upload progress, failure recovery and shared-session refresh.
- A platform overview with existing collection counts, payment transactions, user lookup and system observations; existing club, event, tournament and product management remains available. Club workspaces show active organisation context, clear stale context on switching and restrict financial display to owners/admins.

## Backend changes

No database migration or new collection is required.

| Area | Change |
| --- | --- |
| Public players | `/players` accepts guests; sensitive account fields and exact coordinates are excluded. Game hosts, post authors and player details use an explicit public-profile allowlist. |
| Published content | Public event/tournament discovery always excludes drafts. Existing admin/org endpoints remain the management entry points. |
| Facilities | Existing facility responses include a club name when an organisation is linked. |
| Platform reporting | Four authenticated platform-admin GET endpoints: `/admin/overview`, `/admin/users`, `/admin/transactions`, `/admin/system-health`. Payment output excludes checkout tokens and gateway payloads. |
| Club analytics | Managers retain operational counts but receive no financial amount. Owner/admin booking value counts confirmed bookings, excluding pending payments. |
| AI branding | Coach identity and own-library citation names use MatchDrome. Existing knowledge content, evidence requirements, job contracts and analyses remain intact. |

## Existing backend limits

The repository does not provide general event RSVP, private messaging, a notification inbox, support-ticket management, refunds/reconciliation actions, user suspension/reactivation or per-field profile privacy settings. Those workflows were not fabricated. Events have detail pages and link to an associated game when available; otherwise the UI directs players to the venue. The Chat tab retains the existing community experience. Personal Activity shows bookings, orders and coaching reports. Monitoring distinguishes observed job data from unavailable worker/knowledge-refresh monitoring.

New privacy controls, cross-device favourites, event RSVP and direct messaging require product and backend extensions beyond the existing contracts. Club memberships, staff roles, pricing, bookings, events and tournaments continue to use the existing supported operations.

## Verification

Passed:

- `cd frontend && npm run typecheck`
- `node frontend/tests/reliability.cjs`: login continuation/cancel, safe return routes, error sanitisation, missing data, sport formatting, role isolation, payment verification, web/native multipart fields and upload progress.
- `cd frontend && npx expo export --platform web`
- Python compilation of modified backend modules.
- 22 targeted backend tests: existing RBAC and evidence-grounded AI-report tests plus new admin access, transaction projection, manager finance exclusion, confirmed-booking totals, cross-club access and public-profile privacy tests.

The backend tests use database doubles and test-only configuration. No production MongoDB, SMS, payment or AI-worker transactions were performed.

Pending release verification:

- Interactive visual checks on 320/390/430-point phones and tablet/desktop, including keyboard and screen-reader navigation. Chromium could not launch in this execution environment, so no screenshot or browser-interaction pass is claimed.
- Real Firebase OTP, PayU sandbox return flows, native photo/video uploads and an actual worker-produced report against a configured staging backend.
- Confirm production sports photography availability and event/club content with real catalogue data.

The frontend lockfile was repaired after the original `npm ci` rejected missing platform-specific optional dependency entries. No application dependency was added for the redesign.

## Role workspace follow-up

Replaced the legacy admin and club layouts with shared MatchDrome navigation, readable desktop columns/mobile cards, searchable lists and keyboard-aware, scrollable form sheets. Navigation no longer grows into the content area. Form buttons have at least 44-point targets; destructive operations use a confirmation sheet on both web and native. Image selection remains available alongside image URLs.

- Platform: dedicated overview, clubs, users, events, tournaments, products, finance, venue issues, system and audit sections. Open a club workspace for its courts, operations and staff. Owner assignment and existing platform-admin grants are exposed. Knowledge refresh uses the existing protected AI endpoint.
- Owner/admin: court creation/editing/deletion, pricing, slot overrides and resets, booking confirmation/cancellation/export, events and tournaments with editing and publish states, staff creation/role changes/removal, club details/location/status, audit history and owner-only transfer.
- Manager: operational booking lookup, check-in, court schedule, events/tournaments, open games and issue reporting. No finance, staff role management or ownership controls.
- Staff: booking lookup/confirmation/check-in, court discovery, open games and issue reporting. No cancellation, pricing, schedule writes, events management or role controls.

Additive backend support: `venue_issues` stores scoped issue reports/resolutions; bookings gain optional `checked_in_at`/`checked_in_by` fields. Existing collections and API contracts remain compatible. Check-in requires an already confirmed booking. Manual confirmation cannot bypass pending gateway payment. Staff assignment protects owners, and event/tournament venue assignments require a venue in the active club. New issue/check-in operations write audit records.

Operational cards use the latest API result windows, not all-time totals; booking lists are capped at the existing 300 records. Club customer lookup searches those bookings. General event attendance/RSVP, customer memberships, organisation product ownership, user suspension, payment refunds and full community moderation remain outside existing supported contracts; this change does not invent those workflows.

The follow-up adds regression coverage for staff/manager restrictions, protected owner roles, payment-safe check-in, check-in idempotency and club-scoped issue resolution.
