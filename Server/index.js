// server/index.js
require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5000;

// 1. Middleware
// Configured in app.js.

// 2. Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("[PlayMatch] ✅ Connected to MongoDB"))
  .catch(err => console.error("[PlayMatch] ❌ MongoDB Error:", err));

// 3. Routes (THIS IS THE IMPORTANT PART)
// We tell the server: "Any URL starting with /api, go look in api.js"
// Registered in app.js.

// 4. Start Server
app.listen(PORT, () => {
  console.log(`[PlayMatch] 🚀 Server running on port ${PORT}`);
});
