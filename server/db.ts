import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type Provider = { id: number; name: string; specialty: string };
export type Appointment = {
  id: string;
  providerId: number;
  providerName: string;
  customerName: string;
  customerEmail: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'BOOKED' | 'CANCELLED';
  createdAt: string;
};

export function createDatabase(file = process.env.DATABASE_PATH ?? './data/appointments.sqlite') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      provider_id INTEGER NOT NULL REFERENCES providers(id),
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('BOOKED', 'CANCELLED')),
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_per_slot
      ON appointments(provider_id, appointment_date, start_time)
      WHERE status = 'BOOKED';
  `);
  const count = (db.prepare('SELECT COUNT(*) AS count FROM providers').get() as { count: number }).count;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO providers (name, specialty) VALUES (?, ?)');
    insert.run('Dr. Ananya Sharma', 'General physician');
    insert.run('Dr. Rohan Mehta', 'Dermatologist');
  }
  return db;
}

const appointmentSelect = `SELECT a.id, a.provider_id AS providerId, p.name AS providerName,
  a.customer_name AS customerName, a.customer_email AS customerEmail,
  a.appointment_date AS date, a.start_time AS startTime, a.end_time AS endTime,
  a.status, a.created_at AS createdAt
  FROM appointments a JOIN providers p ON p.id = a.provider_id`;

export function listProviders(db: Database.Database): Provider[] {
  return db.prepare('SELECT id, name, specialty FROM providers ORDER BY id').all() as Provider[];
}

export function listAppointments(db: Database.Database): Appointment[] {
  return db.prepare(`${appointmentSelect} ORDER BY a.appointment_date DESC, a.start_time DESC`).all() as Appointment[];
}

export function findAppointment(db: Database.Database, id: string): Appointment | undefined {
  return db.prepare(`${appointmentSelect} WHERE a.id = ?`).get(id) as Appointment | undefined;
}

export function bookedStarts(db: Database.Database, providerId: number, date: string): string[] {
  return (db.prepare("SELECT start_time AS time FROM appointments WHERE provider_id = ? AND appointment_date = ? AND status = 'BOOKED'")
    .all(providerId, date) as { time: string }[]).map((row) => row.time);
}
