import express from 'express';
import apiApp from './server/app.js';

const app = express();
app.use(apiApp);

export default app;
