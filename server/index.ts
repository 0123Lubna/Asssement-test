import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase, findAppointment, initializeDatabase, listAppointments, listProviders } from './db.js';
import { bookAppointment, BookingError, cancelAppointment, getAvailableSlots } from './booking.js';

const app = express();
const db = createDatabase();
try {
  await initializeDatabase(db);
} catch (error) {
  console.error('Could not initialize PostgreSQL. Check DATABASE_URL and the database connection.', error);
  await db.end();
  process.exit(1);
}

app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/providers', async (_req, res) => res.json(await listProviders(db)));
app.get('/api/availability', async (req, res) => {
  const providerId = Number(req.query.providerId);
  const date = String(req.query.date ?? '');
  if (!Number.isInteger(providerId) || providerId <= 0 || !date) return res.status(400).json({ error: 'Provider and date are required.' });
  res.json({ providerId, date, timeZone: 'Asia/Kolkata', slots: await getAvailableSlots(db, providerId, date) });
});
app.get('/api/appointments', async (_req, res) => res.json(await listAppointments(db)));
app.get('/api/appointments/:id', async (req, res) => {
  const appointment = await findAppointment(db, req.params.id);
  return appointment ? res.json(appointment) : res.status(404).json({ error: 'Appointment not found. Check the booking ID and try again.' });
});
app.post('/api/appointments', async (req, res) => {
  try {
    const appointment = await bookAppointment(db, req.body);
    return res.status(201).json(appointment);
  } catch (error) {
    if (error instanceof BookingError) return res.status(error.statusCode).json({ error: error.message });
    console.error(error);
    return res.status(500).json({ error: 'We could not save your appointment. Please try again.' });
  }
});
app.post('/api/appointments/:id/cancel', async (req, res) => {
  try { return res.json(await cancelAppointment(db, req.params.id)); }
  catch (error) {
    if (error instanceof BookingError) return res.status(error.statusCode).json({ error: error.message });
    console.error(error);
    return res.status(500).json({ error: 'We could not cancel this appointment. Please try again.' });
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'Request body must contain valid JSON.' });
  console.error(error);
  return res.status(500).json({ error: 'The request could not be completed. Please try again.' });
});

const port = Number(process.env.PORT ?? 4000);
if (process.env.NODE_ENV === 'production') {
  const here = path.dirname(fileURLToPath(import.meta.url));
  app.use(express.static(path.resolve(here, '../client')));
  app.get('*path', (_req, res) => res.sendFile(path.resolve(here, '../client/index.html')));
}
app.listen(port, () => console.log(`Appointment API connected to PostgreSQL at http://localhost:${port}`));
