import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { planRouter } from './routes/plan.js';

export function createApp(db) {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/healthz', (req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', authRouter(db));
  app.use('/api', planRouter(db));

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'not found' });
  });

  app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'internal server error' });
  });

  return app;
}
