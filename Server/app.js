// server/app.js

const express = require('express');
const cors = require('cors');

// Initialize the express app
const app = express();

// --- Core Middleware ---
app.use(cors()); 
app.use(express.json()); 

// --- Routes ---
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Export the configured app
module.exports = app;