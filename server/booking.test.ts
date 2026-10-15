import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabase, listAppointments } from './db.js';
import { bookAppointment, BookingError, cancelAppointment, getAvailableSlots } from './booking.js';

const futureWeekday = '2099-01-05';
const input = (overrides: Partial<Parameters<typeof bookAppointment>[1]> = {}) => ({
  providerId: 1, customerName: 'Sam Taylor', customerEmail: 'sam@example.com', date: futureWeekday, startTime: '10:00', ...overrides,
});
const now = new Date('2026-10-15T04:00:00.000Z');

test('books and persists an available appointment', () => {
  const db = createDatabase(':memory:');
  try {
    const booking = bookAppointment(db, input(), now);
    assert.equal(booking.status, 'BOOKED');
    assert.equal(booking.endTime, '10:30');
    assert.equal(listAppointments(db).length, 1);
    assert.ok(!getAvailableSlots(db, 1, futureWeekday, now).includes('10:00'));
  } finally { db.close(); }
});

test('rejects duplicate and overlapping active bookings while allowing another provider', () => {
  const db = createDatabase(':memory:');
  try {
    bookAppointment(db, input(), now);
    assert.throws(() => bookAppointment(db, input(), now), (error) => error instanceof BookingError && error.statusCode === 409);
    assert.throws(() => bookAppointment(db, input({ startTime: '10:15' }), now), (error) => error instanceof BookingError && error.statusCode === 400);
    assert.equal(bookAppointment(db, input({ providerId: 2 }), now).status, 'BOOKED');
  } finally { db.close(); }
});

test('database uniqueness prevents a second active booking even when a write bypasses the API check', () => {
  const db = createDatabase(':memory:');
  try {
    bookAppointment(db, input(), now);
    assert.throws(() => db.prepare(`INSERT INTO appointments
      (id, provider_id, customer_name, customer_email, appointment_date, start_time, end_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'BOOKED', ?)`)
      .run('second-record', 1, 'Another Customer', 'other@example.com', futureWeekday, '10:00', '10:30', now.toISOString()),
    (error) => (error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE');
  } finally { db.close(); }
});

test('rejects bookings outside working hours', () => {
  const db = createDatabase(':memory:');
  try {
    assert.throws(() => bookAppointment(db, input({ startTime: '18:00' }), now), (error) => error instanceof BookingError && error.statusCode === 400);
  } finally { db.close(); }
});

test('cancellation is repeatable and releases the slot for rebooking', () => {
  const db = createDatabase(':memory:');
  try {
    const original = bookAppointment(db, input(), now);
    assert.equal(cancelAppointment(db, original.id).status, 'CANCELLED');
    assert.equal(cancelAppointment(db, original.id).status, 'CANCELLED');
    assert.equal(getAvailableSlots(db, 1, futureWeekday, now).includes('10:00'), true);
    assert.equal(bookAppointment(db, input(), now).status, 'BOOKED');
    assert.equal(listAppointments(db).length, 2);
  } finally { db.close(); }
});

test('rejects Sunday and past slots', () => {
  const db = createDatabase(':memory:');
  try {
    assert.throws(() => bookAppointment(db, input({ date: '2099-01-04' }), now), (error) => error instanceof BookingError && error.statusCode === 409);
    assert.throws(() => bookAppointment(db, input({ date: '2026-10-15', startTime: '10:00' }), new Date('2026-10-15T05:00:00.000Z')), (error) => error instanceof BookingError && error.statusCode === 409);
  } finally { db.close(); }
});
