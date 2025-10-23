// server/routes/api.js

const express = require('express');
const axios = require('axios');

// Create a new router
const router = express.Router();

// Get API keys from environment variables
const STEAM_API_KEY = process.env.STEAM_API_KEY;
const RAWG_API_KEY = process.env.RAWG_API_KEY;

/**
 * GET /api/recommendations/:steamid
 * This is the main endpoint for PlayMatch.
 * It takes a user's Steam ID and a 'mood' query.
 * e.g., /api/recommendations/76561197960287930?mood=cozy
 */
router.get('/recommendations/:steamid', async (req, res) => {
  try {
    const { steamid } = req.params;
    const { mood } = req.query;

    console.log(`[PlayMatch] Received request for SteamID: ${steamid}, Mood: ${mood}`);

    // 1. --- Define Mood-to-Tag Mapping ---
    // We will expand this later.
    const moodTagMap = {
      'cozy': ['cozy', 'farming-sim', 'life-sim', 'relaxing', 'cute'],
      'skyrim-like': ['open-world', 'rpg', 'fantasy', 'first-person', 'adventure'],
    };

    const targetTags = moodTagMap[mood.toLowerCase()];

    if (!targetTags) {
      return res.status(400).json({ error: 'Invalid mood specified' });
    }

    // 2. --- Fetch User's Owned Games from Steam ---
    // We will build this out next. For now, we'll log it.
    console.log(`[PlayMatch] Fetching games for ${steamid}...`);
    // TODO: Add Steam API call here

    // 3. --- Fetch Game Details from RAWG (and filter) ---
    // TODO: Add RAWG API calls here
    console.log(`[PlayMatch] Filtering games with tags: ${targetTags.join(', ')}`);


    // 4. --- Return Mock Data (for now) ---
    // This is a placeholder so we can test the route.
    const mockRecommendations = [
      { id: 414940, name: 'Stardew Valley', tags: ['cozy', 'farming-sim'] },
      { id: 582010, name: 'Monster Hunter: World', tags: ['open-world', 'rpg'] },
    ];

    res.json({
      requestedSteamId: steamid,
      requestedMood: mood,
      recommendations: mockRecommendations,
    });

  } catch (error) {
    console.error('[PlayMatch] Error in /recommendations route:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Export the router
module.exports = router;