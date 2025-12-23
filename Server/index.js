// server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Middleware
app.use(cors());
app.use(express.json());

// 2. Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("[PlayMatch] ✅ Connected to MongoDB"))
  .catch(err => console.error("[PlayMatch] ❌ MongoDB Error:", err));

// 3. Routes (THIS IS THE IMPORTANT PART)
// We tell the server: "Any URL starting with /api, go look in api.js"
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// 4. Start Server
app.listen(PORT, () => {
  console.log(`[PlayMatch] 🚀 Server running on port ${PORT}`);
});