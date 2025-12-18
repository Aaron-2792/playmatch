// server/config/db.js

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // server/config/db.js

    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`[PlayMatch] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[PlayMatch] MongoDB Error: ${error.message}`);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;