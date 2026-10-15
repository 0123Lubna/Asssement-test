import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabase, initializeDatabase } from './db.js';

type LocalAppointment = {
  id: string;
  provider_id: number;
  customer_name: string;
  customer_email: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: 'BOOKED' | 'CANCELLED';
  created_at: string;
};

const localPath = process.env.DATABASE_PATH ?? './data/appointments.sqlite';
const resolvedLocalPath = path.resolve(localPath);
if (!fs.existsSync(resolvedLocalPath)) {
  throw new Error(`Local SQLite database was not found at ${resolvedLocalPath}. Set DATABASE_PATH to its location.`);
}

const local = new Database(resolvedLocalPath, { readonly: true, fileMustExist: true });
const cloud = createDatabase();
try {
  await initializeDatabase(cloud);
  const appointments = local.prepare(`SELECT id, provider_id, customer_name, customer_email, appointment_date,
    start_time, end_time, status, created_at FROM appointments`).all() as LocalAppointment[];
  let migrated = 0;
  let skipped = 0;
  for (const appointment of appointments) {
    const result = await cloud.query(`INSERT INTO appointments
      (id, provider_id, customer_name, customer_email, appointment_date, start_time, end_time, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT DO NOTHING`, [
      appointment.id, appointment.provider_id, appointment.customer_name, appointment.customer_email,
      appointment.appointment_date, appointment.start_time, appointment.end_time, appointment.status, appointment.created_at,
    ]);
    if (result.rowCount) migrated += result.rowCount;
    else skipped += 1;
  }
  console.log(`Local booking import finished: ${migrated} imported, ${skipped} already present or conflicting.`);
} finally {
  local.close();
  await cloud.end();
}
