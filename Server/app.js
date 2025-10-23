// server/app.js

const express = require('express');
const cors = require('cors');

// Initialize the express app
const app = express();

// --- Core Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse incoming JSON request bodies

// --- Routes ---
// Import our new API routes
const apiRoutes = require('./routes/api');

// Tell Express to use those routes for any path that starts with /api
app.use('/api', apiRoutes);

// Export the configured app
module.exports = app;