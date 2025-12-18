// server/models/Game.js

const mongoose = require('mongoose');

// This is the "blueprint" for a game document in our database
const gameSchema = new mongoose.Schema({
  appId: {
    type: Number,
    required: true,
    unique: true, // We should only have one entry per Steam AppID
    index: true,    // Adds an index for faster lookups by appId
  },
  name: {
    type: String,
    required: true,
  },
  tags: {
    type: [String], // An array of strings
  },
  genres: {
    type: [String], // An array of strings
  },
  description: {
    type: String,
  },
  backgroundImage: {
    type: String,
  },
  lastFetched: {
    type: Date,
    default: Date.now, // Automatically set the timestamp when created
  },
});

// Create the "Game" model from the schema and export it
module.exports = mongoose.model('Game', gameSchema);