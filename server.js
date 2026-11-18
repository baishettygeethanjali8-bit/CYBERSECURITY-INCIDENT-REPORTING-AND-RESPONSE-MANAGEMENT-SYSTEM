require('dotenv').config();

const cors = require('cors');
const cookieParser = require('cookie-parser');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const helmet = require('helmet');
const mongoose = require('mongoose');
const connectDatabase = require('./config/database');
const authRoutes = require('./routes/auth');
const incidentRoutes = require('./routes/incidents');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const reportRoutes = require('./routes/reports');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error(
    'Set JWT_SECRET to a random value of at least 32 characters in backend/.env (see backend/.env.example)',
  );
}

const app = express();
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(helmet());
app.use(cors({ origin: clientUrl, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 });
});

app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  authRoutes,
);
app.use('/api/incidents', incidentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);

app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((error, _req, res, _next) => {
  console.error('API request failed:', error.name, error.code || '');
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body contains invalid JSON.' });
  }
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: 'Incident details are invalid.' });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
});

const port = Number(process.env.PORT) || 5001;
connectDatabase()
  .then(() => {
    app.listen(port, () => console.log(`Incident API listening on port ${port}`));
  })
  .catch((error) => {
    console.error(
      'Unable to connect to MongoDB. Check that it is running and MONGODB_URI in backend/.env is correct.',
    );
    console.error('Database error:', error.name);
    process.exitCode = 1;
  });