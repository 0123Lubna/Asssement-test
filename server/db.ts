import { Pool, type QueryResultRow } from 'pg';

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

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }>;
}

export function createDatabase(connectionString = process.env.DATABASE_URL): Pool {
  if (!connectionString) throw new Error('DATABASE_URL is missing. Create a Neon PostgreSQL database and add its connection string to .env.');
  return new Pool({ connectionString, max: 5 });
}

export async function initializeDatabase(db: Queryable): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL
    )`);
  await db.query(`CREATE TABLE IF NOT EXISTS appointments (
      id UUID PRIMARY KEY,
      provider_id INTEGER NOT NULL REFERENCES providers(id),
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('BOOKED', 'CANCELLED')),
      created_at TEXT NOT NULL
    )`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_per_slot
      ON appointments(provider_id, appointment_date, start_time)
      WHERE status = 'BOOKED'`);
  await db.query(`INSERT INTO providers (id, name, specialty) VALUES
    (1, 'Dr. Ananya Sharma', 'General physician'),
    (2, 'Dr. Rohan Mehta', 'Dermatologist')
    ON CONFLICT (id) DO NOTHING`);
}

const appointmentSelect = `SELECT a.id, a.provider_id AS "providerId", p.name AS "providerName",
  a.customer_name AS "customerName", a.customer_email AS "customerEmail",
  a.appointment_date AS date, a.start_time AS "startTime", a.end_time AS "endTime",
  a.status, a.created_at AS "createdAt"
  FROM appointments a JOIN providers p ON p.id = a.provider_id`;

export async function listProviders(db: Queryable): Promise<Provider[]> {
  const result = await db.query<Provider>('SELECT id, name, specialty FROM providers ORDER BY id');
  return result.rows;
}

export async function listAppointments(db: Queryable): Promise<Appointment[]> {
  const result = await db.query<Appointment>(`${appointmentSelect} ORDER BY a.appointment_date DESC, a.start_time DESC`);
  return result.rows;
}

export async function findAppointment(db: Queryable, id: string): Promise<Appointment | undefined> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return undefined;
  const result = await db.query<Appointment>(`${appointmentSelect} WHERE a.id = $1`, [id]);
  return result.rows[0];
}

export async function bookedStarts(db: Queryable, providerId: number, date: string): Promise<string[]> {
  const result = await db.query<{ time: string }>("SELECT start_time AS time FROM appointments WHERE provider_id = $1 AND appointment_date = $2 AND status = 'BOOKED'", [providerId, date]);
  return result.rows.map((row) => row.time);
}
