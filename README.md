# Goodwell Appointment Booking

A full-stack appointment booking app built for the engineering assessment. Customers can view two seeded providers, choose an IST appointment slot, book, look up, and cancel appointments. The management page lists booking history and supports cancellation.

## Prerequisites

- Node.js 20 or newer (Node.js 22 recommended)
- npm

No separate database server is required. SQLite is embedded in the Node application.

## Setup

```bash
npm install
```

The first server start creates `data/appointments.sqlite` and seeds two providers. The `data/` directory is intentionally excluded from version control.

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API and production web server port |
| `DATABASE_PATH` | `./data/appointments.sqlite` | SQLite database file location |

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

## Tests and checks

```bash
npm test
npm run typecheck
```

Tests cover successful booking, duplicate/conflicting slot rejection, invalid hours, cancellation and rebooking, Sunday/past-date rejection, provider-specific availability, and appointment history retention.

## Architecture

- `src/ui`: React booking form, slot picker, confirmation, booking lookup, and appointment management UI.
- `server/index.ts`: Express JSON API and HTTP error responses.
- `server/booking.ts`: slot generation and booking/cancellation rules, with IST-aware past-time checks.
- `server/db.ts`: SQLite schema, seed data, and query helpers.
- `server/booking.test.ts`: business logic tests using isolated in-memory SQLite databases.

The API always validates availability again when a booking is submitted. A SQLite partial unique index permits only one `BOOKED` appointment per provider/date/start time; SQLite serializes conflicting writes and rejects the loser. Cancelled rows remain in the database and no longer occupy a slot. Appointment duration, provider working hours, and time zone follow the fixed assessment rules.

## AI usage summary

Codex was used to translate the assessment requirements into an implementation plan, scaffold the React/Express/SQLite TypeScript application, and draft the booking logic, interface, tests, and documentation. The implementation is validated with the included automated checks; review the code and explain the slot validation and database uniqueness design during assessment discussion.

## Known limitations

- Provider configuration is intentionally fixed to the two seeded providers; there is no provider administration.
- Authentication, email reminders, payments, custom hours, and rescheduling are out of scope.
- Booking IDs are unguessable UUIDs, but lookup and cancellation have no authentication, as allowed by the assessment.
- SQLite is appropriate for this local assessment. A high-traffic multi-instance deployment would need an operationally managed database and deployment-specific concurrency review.
