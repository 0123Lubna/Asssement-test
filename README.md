# Goodwell Appointment Booking

A full-stack appointment booking app built for the engineering assessment. Customers can view two seeded providers, choose an IST appointment slot, book, look up, and cancel appointments. The management page lists booking history and supports cancellation.

## Prerequisites

- Node.js 20 or newer (Node.js 22 recommended)
- npm
- A PostgreSQL database; the app is configured for Neon PostgreSQL

## Setup

```bash
npm install
```

Create a free Neon PostgreSQL project. In the Neon console, open **Connect**, choose the database and branch, enable **Pooled connection**, then copy the connection string. Create a local `.env` file in the project root based on `.env.example` and set:

```env
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

Replace the sample URL with the connection string from Neon. Keep `.env` private; it is ignored by Git. The app creates the required tables, unique index, and two seed providers at startup.

| Variable | Purpose |
| --- | --- |
| `PORT` | API and production web server port (default `4000`) |
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `DATABASE_PATH` | Optional path to the old SQLite file for the one-time import command only |

## Run locally

```bash
npm run dev
```

Open the Vite URL printed in the terminal (usually <http://localhost:5173>). The Vite development server forwards `/api` requests to the API at port 4000.

For a production build:

```bash
npm run build
npm start
```

Open <http://localhost:4000>.

## Deploy to Vercel

The root `server.ts` exports the Express application for Vercel Functions. `npm run build` writes the Vite frontend into `public/`, which Vercel serves as static assets. Import this GitHub repository into Vercel and use the Express framework preset with `npm run build` as the build command. Add `DATABASE_URL` in the Vercel project's Environment Variables for Production (and Preview if you want preview deployments to use Neon). Use the pooled Neon connection string and keep it server-side; do not add the `VITE_` prefix. Deploy or redeploy after saving the variable. Because this assessment intentionally has no authentication, deploy with demo-only appointment data: the management API lists appointments and allows cancellation by booking ID.

## Import existing local bookings

The app now reads and writes to PostgreSQL. To copy records from the previous local SQLite database into the configured PostgreSQL database, set `DATABASE_PATH` in `.env` if the SQLite file is in a different location, then run:

```bash
npm run db:migrate-local
```

The import preserves booking IDs and statuses. Existing rows or active slots that already conflict in PostgreSQL are skipped. The command is safe to repeat.

## Tests and checks

```bash
npm test
npm run typecheck
```

Tests cover successful booking, concurrent and duplicate slot rejection, invalid hours, cancellation and rebooking, Sunday/past-date rejection, provider-specific availability, and appointment history retention. Tests use isolated SQLite databases as a lightweight SQL test harness; the deployed application uses PostgreSQL.

## Architecture

- `src/ui`: React booking form, slot picker, confirmation, booking lookup, and appointment management UI.
- `server.ts`: Vercel entry point for the Express application.
- `server/app.ts`: Express API routes, database initialization, and HTTP error responses.
- `server/index.ts`: Local production server and static-file hosting.
- `server/booking.ts`: slot generation and booking/cancellation rules, with IST-aware past-time checks.
- `server/db.ts`: PostgreSQL schema, provider seed data, query pool, and query helpers.
- `server/booking.test.ts`: automated business logic tests.
- `server/migrate-local.ts`: optional one-time import of earlier SQLite bookings.

The API rechecks availability when a booking is submitted. A PostgreSQL partial unique index permits only one `BOOKED` appointment per provider/date/start time, preventing conflicting writes even when requests arrive together. Cancelled rows remain in the database and no longer occupy a slot. Appointment duration, provider working hours, and time zone follow the fixed assessment rules.

## AI usage summary

Codex was used to translate the assessment requirements into an implementation plan, scaffold the React/Express/TypeScript application, implement the booking logic and database integration, and draft the interface, tests, and documentation. The implementation is validated with the included automated checks; review the code and explain the slot validation and database uniqueness design during assessment discussion.

## Known limitations

- Provider configuration is intentionally fixed to the two seeded providers; there is no provider administration.
- Authentication, email reminders, payments, custom hours, and rescheduling are out of scope.
- Booking IDs are unguessable UUIDs, but lookup and cancellation have no authentication, as allowed by the assessment.
- Do not use this unauthenticated assessment build with real customer data on a public deployment.
- The Neon free plan has resource limits and may pause compute while idle; the first request after inactivity can take longer. Check the provider's current plan limits before using it beyond the assessment.
