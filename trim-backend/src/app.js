require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const weightRoutes = require('./routes/weights');
const mealRoutes = require('./routes/meals');
const activityRoutes = require('./routes/activities');
const statsRoutes = require('./routes/stats');
const templateRoutes = require('./routes/templates');
const patternRoutes  = require('./routes/patterns');
const quicklogRoutes = require('./routes/quicklog');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Sau proxy (Railway), client IP thật nằm trong X-Forwarded-For. KHÔNG set trust proxy
// thì express-rate-limit key theo IP của proxy (giống nhau cho mọi request) → authLimiter
// vô dụng. Tin ĐÚNG 1 hop proxy (giá trị 1), KHÔNG dùng `true`: `true` tin mọi proxy nên
// attacker có thể spoof X-Forwarded-For để lách rate limit. (finding F3)
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : true,
  credentials: true,
}));

const isTest = process.env.NODE_ENV === 'test';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 5,
  message: 'Too many authentication attempts, please try again later.',
});
app.use('/api/auth', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/weights', weightRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/patterns',  patternRoutes);
app.use('/api/quicklog',  quicklogRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;
