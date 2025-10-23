// server/index.js

// Load environment variables from .env file immediately
require('dotenv').config();

// Import the configured express app
const app = require('./app');

// Define the port, falling back to 5000
const port = process.env.PORT || 5000;

// Start the server
app.listen(port, () => {
  console.log(`PlayMatch server listening at http://localhost:${port}`);
});