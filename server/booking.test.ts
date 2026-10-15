import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { initializeDatabase, listAppointments, type Queryable } from './db.js';
import { bookAppointment, BookingError, cancelAppointment, getAvailableSlots } from './booking.js';

type TestDatabase = Queryable & { close: () => void };

async function createTestDatabase(): Promise<TestDatabase> {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db: TestDatabase = {
    async query<R extends { [column: string]: unknown }>(text: string, values: unknown[] = []) {
      const sql = text.replace(/\$(\d+)/g, '?');
      if (/^\s*(SELECT|WITH)\b/i.test(sql)) {
        return { rows: sqlite.prepare(sql).all(...values) as R[], rowCount: null };
      }
      const result = sqlite.prepare(sql).run(...values);
      return { rows: [] as R[], rowCount: result.changes };
    },
    close: () => sqlite.close(),
  };
  await initializeDatabase(db);
  return db;
}

const futureWeekday = '2099-01-05';
const input = (overrides: Partial<Parameters<typeof bookAppointment>[1]> = {}) => ({
  providerId: 1, customerName: 'Sam Taylor', customerEmail: 'sam@example.com', date: futureWeekday, startTime: '10:00', ...overrides,
});
const now = new Date('2026-10-15T04:00:00.000Z');

test('books and persists an available appointment', async () => {
  const db = await createTestDatabase();
  try {
    const booking = await bookAppointment(db, input(), now);
    assert.equal(booking.status, 'BOOKED');
    assert.equal(booking.endTime, '10:30');
    assert.equal((await listAppointments(db)).length, 1);
    assert.ok(!(await getAvailableSlots(db, 1, futureWeekday, now)).includes('10:00'));
  } finally { db.close(); }
});

test('rejects duplicate and overlapping active bookings while allowing another provider', async () => {
  const db = await createTestDatabase();
  try {
    await bookAppointment(db, input(), now);
    await assert.rejects(() => bookAppointment(db, input(), now), (error) => error instanceof BookingError && error.statusCode === 409);
    await assert.rejects(() => bookAppointment(db, input({ startTime: '10:15' }), now), (error) => error instanceof BookingError && error.statusCode === 400);
    assert.equal((await bookAppointment(db, input({ providerId: 2 }), now)).status, 'BOOKED');
  } finally { db.close(); }
});

test('database uniqueness permits only one winner for simultaneous booking attempts', async () => {
  const db = await createTestDatabase();
  try {
    const results = await Promise.allSettled([bookAppointment(db, input(), now), bookAppointment(db, input(), now)]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected' && result.reason instanceof BookingError && result.reason.statusCode === 409).length, 1);
  } finally { db.close(); }
});

test('rejects bookings outside working hours', async () => {
  const db = await createTestDatabase();
  try {
    await assert.rejects(() => bookAppointment(db, input({ startTime: '18:00' }), now), (error) => error instanceof BookingError && error.statusCode === 400);
  } finally { db.close(); }
});

test('cancellation is repeatable and releases the slot for rebooking', async () => {
  const db = await createTestDatabase();
  try {
    const original = await bookAppointment(db, input(), now);
    assert.equal((await cancelAppointment(db, original.id)).status, 'CANCELLED');
    assert.equal((await cancelAppointment(db, original.id)).status, 'CANCELLED');
    assert.equal((await getAvailableSlots(db, 1, futureWeekday, now)).includes('10:00'), true);
    assert.equal((await bookAppointment(db, input(), now)).status, 'BOOKED');
    assert.equal((await listAppointments(db)).length, 2);
  } finally { db.close(); }
});

test('rejects bookings outside working hours, on Sundays, and in the past', async () => {
  const db = await createTestDatabase();
  try {
    await assert.rejects(() => bookAppointment(db, input({ date: '2099-01-04' }), now), (error) => error instanceof BookingError && error.statusCode === 409);
    await assert.rejects(() => bookAppointment(db, input({ date: '2026-10-15', startTime: '10:00' }), new Date('2026-10-15T05:00:00.000Z')), (error) => error instanceof BookingError && error.statusCode === 409);
  } finally { db.close(); }
});
