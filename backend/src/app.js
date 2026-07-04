import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { planRouter } from './routes/plan.js';
import { sessionsRouter } from './routes/sessions.js';
import { historyRouter } from './routes/history.js';
import { maxTestsRouter } from './routes/maxTests.js';
import { partnerRouter } from './routes/partner.js';

export function createApp(db) {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/healthz', (req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', authRouter(db));
  app.use('/api', planRouter(db));
  app.use('/api', sessionsRouter(db));
  app.use('/api', historyRouter(db));
  app.use('/api', maxTestsRouter(db));
  app.use('/api', partnerRouter(db));

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'not found' });
  });

  app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'internal server error' });
  });

  return app;
}
