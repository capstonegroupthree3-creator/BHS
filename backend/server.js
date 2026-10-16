const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
require('./config/db'); // Test DB connection on startup

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Parse incoming JSON and urlencoded requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/barangays', require('./routes/barangays'));
app.use('/api/citizens', require('./routes/citizens'));
app.use('/api/health', require('./routes/health'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/programs', require('./routes/programs'));
app.use('/api/users', require('./routes/users'));
app.use('/api/seniors', require('./routes/seniors'));

// Base Route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Smart Barangay Health Management System API' });
});

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ 
    message: 'An internal server error occurred', 
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Start Server with Graceful Port Selection
const startServer = (portToTry) => {
  const server = app.listen(portToTry, () => {
    console.log(`Express API Backend Server is running on port ${portToTry}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${portToTry} is already in use. Retrying on port ${portToTry + 1}...`);
      startServer(Number(portToTry) + 1);
    } else {
      console.error('Express server error:', err);
    }
  });
};

startServer(Number(PORT));
