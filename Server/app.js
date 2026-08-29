// server/app.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Initialize the express app
const app = express();

// --- CORS Configuration ---
// Explicitly allow requests from Vercel frontend
const corsOptions = {
  origin: [
    'https://playmatch-gamma.vercel.app',  // Production Vercel domain
    'http://localhost:3000',                // Local development
    'http://localhost:5000'                 // Local testing
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
};

// --- Core Middleware ---
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());

// --- Routes ---
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Export the configured app
module.exports = app;
