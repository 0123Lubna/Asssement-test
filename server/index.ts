import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';

if (process.env.NODE_ENV === 'production') {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDirectory = path.resolve(here, '../../public');
  app.use(express.static(clientDirectory));
  app.get('*path', (_req, res) => res.sendFile(path.join(clientDirectory, 'index.html')));
}

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`Appointment API connected to PostgreSQL at http://localhost:${port}`));
