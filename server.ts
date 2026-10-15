import express from 'express';
import path from 'node:path';
import apiApp from './server/app.js';

const app = express();
app.use(apiApp);

// Vercel invokes this file as the production serverless entry point, so serve
// the Vite build here as well as the API routes.
const clientDirectory = path.resolve(process.cwd(), 'public');
app.use(express.static(clientDirectory));
app.get('*path', (_req, res) => res.sendFile(path.join(clientDirectory, 'index.html')));

export default app;
