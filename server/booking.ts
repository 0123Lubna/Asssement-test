import { randomUUID } from 'node:crypto';
import { bookedStarts, type Appointment, type Queryable } from './db.js';

export const TIME_ZONE = 'Asia/Kolkata';
export const WORK_START_MINUTES = 10 * 60;
export const WORK_END_MINUTES = 18 * 60;

export class BookingError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export type BookingInput = { providerId: number; customerName: string; customerEmail: string; date: string; startTime: string };

function istParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function getAvailableSlots(db: Queryable, providerId: number, date: string, now = new Date()): Promise<string[]> {
  const provider = await db.query('SELECT id FROM providers WHERE id = $1', [providerId]);
  if (!provider.rows.length || !isValidDate(date)) return [];
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekday === 0) return [];
  const current = istParts(now);
  const occupied = new Set(await bookedStarts(db, providerId, date));
  const slots: string[] = [];
  for (let minutes = WORK_START_MINUTES; minutes < WORK_END_MINUTES; minutes += 30) {
    const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    if (!occupied.has(time) && (date > current.date || (date === current.date && time > current.time))) slots.push(time);
  }
  return slots;
}

export async function bookAppointment(db: Queryable, input: BookingInput, now = new Date()): Promise<Appointment> {
  const { providerId, customerName, customerEmail, date, startTime } = input;
  if (!Number.isInteger(providerId) || !customerName || !customerEmail || !date || !startTime) {
    throw new BookingError(400, 'Provider, customer name, email, date, and time are required.');
  }
  if (customerName.trim().length < 2 || customerName.trim().length > 100) throw new BookingError(400, 'Enter a name between 2 and 100 characters.');
  if (customerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new BookingError(400, 'Enter a valid email address.');
  if (!isValidDate(date) || !/^\d{2}:\d{2}$/.test(startTime)) throw new BookingError(400, 'Enter a valid appointment date and time.');
  const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
  if (startMinutes < WORK_START_MINUTES || startMinutes + 30 > WORK_END_MINUTES || startMinutes % 30 !== 0) {
    throw new BookingError(400, 'Appointments must start every half hour between 10:00 AM and 5:30 PM.');
  }
  const provider = await db.query('SELECT id FROM providers WHERE id = $1', [providerId]);
  if (!provider.rows.length) throw new BookingError(404, 'Service provider not found.');
  const slots = await getAvailableSlots(db, providerId, date, now);
  if (!slots.includes(startTime)) throw new BookingError(409, 'That appointment slot is no longer available. Please choose another time.');

  const id = randomUUID();
  const endTime = `${String(Math.floor((startMinutes + 30) / 60)).padStart(2, '0')}:${String((startMinutes + 30) % 60).padStart(2, '0')}`;
  try {
    await db.query(`INSERT INTO appointments
      (id, provider_id, customer_name, customer_email, appointment_date, start_time, end_time, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'BOOKED', $8)`,
    [id, providerId, customerName.trim(), customerEmail.trim().toLowerCase(), date, startTime, endTime, now.toISOString()]);
  } catch (error) {
    const databaseError = error as { code?: string };
    if (databaseError.code === '23505' || databaseError.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new BookingError(409, 'That appointment slot was just booked. Please choose another time.');
    }
    throw error;
  }
  const appointment = await db.query<Appointment>(`SELECT a.id, a.provider_id AS "providerId", p.name AS "providerName",
    a.customer_name AS "customerName", a.customer_email AS "customerEmail",
    a.appointment_date AS date, a.start_time AS "startTime", a.end_time AS "endTime",
    a.status, a.created_at AS "createdAt" FROM appointments a JOIN providers p ON p.id = a.provider_id WHERE a.id = $1`, [id]);
  return appointment.rows[0];
}

export async function cancelAppointment(db: Queryable, id: string): Promise<Appointment> {
  if (!isUuid(id)) throw new BookingError(404, 'Appointment not found. Check the booking ID and try again.');
  const existing = await db.query<{ id: string; status: string }>('SELECT id, status FROM appointments WHERE id = $1', [id]);
  if (!existing.rows.length) throw new BookingError(404, 'Appointment not found. Check the booking ID and try again.');
  if (existing.rows[0].status === 'BOOKED') {
    await db.query("UPDATE appointments SET status = 'CANCELLED' WHERE id = $1 AND status = 'BOOKED'", [id]);
  }
  const appointment = await db.query<Appointment>(`SELECT a.id, a.provider_id AS "providerId", p.name AS "providerName",
    a.customer_name AS "customerName", a.customer_email AS "customerEmail",
    a.appointment_date AS date, a.start_time AS "startTime", a.end_time AS "endTime",
    a.status, a.created_at AS "createdAt" FROM appointments a JOIN providers p ON p.id = a.provider_id WHERE a.id = $1`, [id]);
  return appointment.rows[0];
}
