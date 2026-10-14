import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { planRouter } from './routes/plan.js';
import { sessionsRouter } from './routes/sessions.js';
import { historyRouter } from './routes/history.js';
import { maxTestsRouter } from './routes/maxTests.js';
import { friendsRouter } from './routes/friends.js';
import { friendsActivityRouter } from './routes/friendsActivity.js';
import { partnerRouter } from './routes/partner.js';
import { progressRouter } from './routes/progress.js';
import { progressionRouter } from './routes/progression.js';
import { statsRouter } from './routes/stats.js';
import { exportRouter } from './routes/export.js';
import { wrappedRouter } from './routes/wrapped.js';
import { pushRouter } from './routes/push.js';

export function createApp(db) {
  const app = express();

  // Genau ein Proxy-Hop (Caddy): sonst sieht das Rate-Limit fuer alle
  // Requests die Proxy-IP statt der Client-IP.
  app.set('trust proxy', 1);

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
  app.use('/api', friendsRouter(db));
  app.use('/api', friendsActivityRouter(db));
  app.use('/api', partnerRouter(db));
  app.use('/api', progressRouter(db));
  app.use('/api', statsRouter(db));
  app.use('/api', progressionRouter(db));
  app.use('/api', exportRouter(db));
  app.use('/api', wrappedRouter(db));
  app.use('/api', pushRouter(db));

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'not found' });
  });

  app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'internal server error' });
  });

  return app;
}
