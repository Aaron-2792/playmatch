// Vercel Serverless Entry Point
// This file exports the Express app for Vercel to run as serverless functions
// All requests to /api/* are automatically routed here by Vercel

require('dotenv').config();
const mongoose = require('mongoose');

// Import the configured Express app from the Server directory
const app = require('../Server/app');

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("[PlayMatch] ✅ Connected to MongoDB"))
  .catch(err => console.error("[PlayMatch] ❌ MongoDB Error:", err));

// Export the Express app for Vercel serverless
module.exports = app;
