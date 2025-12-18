// server/index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // <--- The CORS import goes here

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); // <--- The CORS usage goes here
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log(`[PlayMatch] MongoDB Connected: ${mongoose.connection.host}`))
  .catch(err => console.error('[PlayMatch Error] MongoDB Connection Error:', err));

// Routes
app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`PlayMatch server listening at http://localhost:${PORT}`);
});