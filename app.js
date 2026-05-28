import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import helmet from 'helmet';

import router from './router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Env validation — warn on missing optional, fail on missing required.
const PORT = Number(process.env.PORT) || 3700;
if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  console.error(`FATAL: PORT must be a valid integer 1-65535, got "${process.env.PORT}"`);
  process.exit(1);
}
if (!process.env.NODE_ENV) {
  console.warn('WARN: NODE_ENV not set, defaulting to "development"');
}

const app = express();
const server = createServer(app);

// Security headers — CSP relaxed to allow inline styles/scripts already present in views.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Morgan logging — single stream to stdout; PM2 captures to /var/log/mir-shared/mirprotocol.log
// which the consolidated log viewer (mir.org) tails.
morgan.token('real-ip', (req) => req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip);
morgan.token('mst-date', () =>
  new Date().toLocaleString('en-US', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
);
const logFormat = ':real-ip - [:mst-date] ":method :url" :status ":user-agent"';
const skipStatic = (req) =>
  /\.(css|js|png|jpg|jpeg|gif|webp|ico|svg|woff|woff2|ttf|eot|map)$/i.test(req.url);
app.use(morgan(logFormat, { skip: skipStatic }));

// Trust proxy
app.set('trust proxy', true);

// WordPress scanner honeypot
app.use((req, res, next) => {
  if (/^\/(wp-login|wp-admin|wp-content|wp-includes|xmlrpc\.php|wp-cron\.php|wp-json)/i.test(req.path)) {
    res.status(404).send(`<html><body style="background:#0a1929;color:#4fd1c5;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center"><div><h1 style="font-size:4rem;margin-bottom:1rem">404</h1><p style="font-size:1.2rem;color:#94a3b8">No WordPress here. Never was. Never will be.</p><p style="font-size:0.9rem;color:#64748b;margin-top:1rem">This server is built on dignity and self-respect.</p></div></body></html>`);
    return;
  }
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Common locals
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.siteName = 'MIR Protocol';
  next();
});

// Routes
app.use('/', router);

// 404
app.use((req, res) => {
  res.status(404).render('404');
});

// Global error handler — must be 4-arg signature for Express to recognize it.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.url} —`, err && err.stack ? err.stack : err);
  if (res.headersSent) return;
  res.status(500).render('500');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mirprotocol.net running on port ${PORT}`);
});
