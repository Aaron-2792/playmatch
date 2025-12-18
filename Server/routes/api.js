// server/routes/api.js

const express = require('express');
const axios = require('axios');
const router = express.Router();

const Game = require('../models/Game'); // Import our Game model

// --- API Keys and URLs ---
const STEAM_API_KEY = process.env.STEAM_API_KEY;
const RAWG_API_KEY = process.env.RAWG_API_KEY;

const STEAM_API_BASE = 'http://api.steampowered.com';
const RAWG_API_URL = 'https://api.rawg.io/api/games';

/**
 * GET /api/recommendations/:identifier
 * Main endpoint for PlayMatch.
 * :identifier can be a Steam64 ID or a custom URL slug.
 */
router.get('/recommendations/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { mood } = req.query;
    let steamId64; // We'll store the final 17-digit ID here

    if (!mood) {
      return res.status(400).json({ error: 'Mood query parameter is required.' });
    }
    console.log(`[PlayMatch] Request received for Identifier: ${identifier}, Mood: ${mood}`);

    // 1. --- Resolve Identifier to Steam64 ID ---
    // Check if the identifier looks like a 17-digit Steam64 ID
    if (/^\d{17}$/.test(identifier)) {
      steamId64 = identifier;
      console.log(`[PlayMatch] Identifier is a Steam64 ID: ${steamId64}`);
    } else {
      // Assume it's a custom URL slug and resolve it
      console.log(`[PlayMatch] Identifier is a Vanity URL: ${identifier}. Resolving...`);
      const vanityUrl = identifier;
      const resolveUrl = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v0001/`;
      try {
        const resolveResponse = await axios.get(resolveUrl, {
          params: {
            key: STEAM_API_KEY,
            vanityurl: vanityUrl,
          },
        });

        if (resolveResponse.data.response && resolveResponse.data.response.success === 1) {
          steamId64 = resolveResponse.data.response.steamid;
          console.log(`[PlayMatch] Resolved Vanity URL to Steam64 ID: ${steamId64}`);
        } else {
          // If success is not 1, the vanity URL was not found
          console.warn(`[PlayMatch] Could not resolve Vanity URL: ${vanityUrl}`);
          return res.status(404).json({ error: `Could not find a Steam profile for "${vanityUrl}". Please provide a valid Steam64 ID or Custom URL.` });
        }
      } catch (vanityError) {
        console.error(`[PlayMatch] Error resolving Vanity URL: ${vanityError.message}`);
        return res.status(500).json({ error: 'Failed to resolve Steam custom URL.' });
      }
    }

    // --- We now have the steamId64 ---

    // 2. --- Fetch User's Owned Games from Steam ---
    console.log(`[PlayMatch] Fetching games from Steam for ${steamId64}...`);
    const ownedGamesUrl = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/`;
    const steamResponse = await axios.get(ownedGamesUrl, {
      params: {
        key: STEAM_API_KEY,
        steamid: steamId64, // Use the resolved ID
        format: 'json',
        include_appinfo: 1,
      },
    });

    // Handle private profiles or errors from Steam
    // Note: The structure check might need adjustment based on exact Steam API empty responses
    if (!steamResponse.data.response || Object.keys(steamResponse.data.response).length === 0 || !steamResponse.data.response.games) {
        console.warn(`[PlayMatch] Steam API returned no games for ${steamId64}. Profile might be private.`);
        // Send a specific error message for potentially private profiles
        return res.status(404).json({ error: 'Could not retrieve game list. The user profile may be private or the Steam ID is incorrect.' });
    }


    const ownedGames = steamResponse.data.response.games;
    console.log(`[PlayMatch] Found ${ownedGames.length} games.`);

    // 3. --- Fetch, Cache, and Filter Game Details ---
    console.log(`[PlayMatch] Starting game detail processing...`);
    let detailedGames = [];
    await Promise.all(
      ownedGames.map(async (steamGame) => {
        try {
          let game = await Game.findOne({ appId: steamGame.appid });
          if (!game) {
            console.log(`[Cache MISS] Fetching ${steamGame.name} (AppID: ${steamGame.appid}) from RAWG...`);
            const rawgResponse = await axios.get(RAWG_API_URL, {
              params: {
                key: RAWG_API_KEY,
                search: steamGame.name,
                // Add platform filter to potentially improve accuracy, e.g., PC = 4
                // platforms: 4, 
                search_exact: true, // Try exact match first
                page_size: 1,
              },
              // Add a timeout to prevent hanging on slow RAWG responses
              timeout: 10000, // 10 seconds timeout
            });

            // Fallback: If exact search fails, try fuzzy search
            let rawgGameData = rawgResponse.data.results[0];
            if (!rawgGameData && rawgResponse.data.count === 0) {
                 console.log(`[RAWG Fallback] No exact match for ${steamGame.name}. Trying fuzzy search...`);
                 const fuzzyRawgResponse = await axios.get(RAWG_API_URL, {
                      params: {
                        key: RAWG_API_KEY,
                        search: steamGame.name,
                        page_size: 1,
                      },
                      timeout: 10000, 
                 });
                 if (fuzzyRawgResponse.data.results && fuzzyRawgResponse.data.results.length > 0){
                      rawgGameData = fuzzyRawgResponse.data.results[0];
                 }
            }


            if (!rawgGameData) {
              console.warn(`[RAWG] No results for ${steamGame.name} (AppID: ${steamGame.appid})`);
              return; // Skip this game if not found on RAWG
            }

            game = new Game({
              appId: steamGame.appid,
              name: rawgGameData.name,
              tags: rawgGameData.tags ? rawgGameData.tags.map(tag => tag.slug) : [],
              genres: rawgGameData.genres ? rawgGameData.genres.map(genre => genre.slug) : [],
              description: rawgGameData.description_raw,
              backgroundImage: rawgGameData.background_image,
              lastFetched: Date.now() // Update fetch time
            });
            await game.save();
            console.log(`[Cache SAVE] Saved ${game.name} to database.`);
          
          } else {
             // Optional: Check if cached data is old and refetch if needed
             // const oneMonth = 30 * 24 * 60 * 60 * 1000;
             // if (Date.now() - game.lastFetched.getTime() > oneMonth) { /* refetch logic */ }
             console.log(`[Cache HIT] Found ${game.name} in database.`);
          }
          detailedGames.push(game);

        } catch (err) {
            // Check for timeout errors specifically
            if (axios.isCancel(err)) {
                console.error(`[RAWG Timeout] Timed out fetching details for ${steamGame.name}`);
            } else if (err.response && err.response.status === 404) {
                 console.warn(`[RAWG 404] Game ${steamGame.name} not found on RAWG.`);
            }
            else {
                 console.error(`[Error] Failed processing for ${steamGame.name}: ${err.message}`);
            }
        }
      })
    );
    console.log(`[PlayMatch] Finished processing. Total detailed games: ${detailedGames.length}`);

    // 4. --- Define Mood-to-Tag Mapping ---
    // Placeholder - Gemini will replace this
    const moodTagMap = {
      'cozy': ['cozy', 'farming-sim', 'life-sim', 'relaxing', 'cute', 'casual'],
      'skyrim-like': ['open-world', 'rpg', 'fantasy', 'first-person', 'adventure', 'magic'],
      'story': ['story-rich', 'great-soundtrack', 'atmospheric', 'singleplayer', 'narrative'],
    };
    const targetTags = moodTagMap[mood.toLowerCase()];
    if (!targetTags) {
      return res.status(400).json({ error: 'Invalid mood specified. Try "cozy", "skyrim-like", or "story".' });
    }

    // 5. --- Filter Games by Mood Tags ---
    const filteredGames = detailedGames.filter(game => 
      (game.tags && game.tags.some(tag => targetTags.includes(tag))) ||
      (game.genres && game.genres.some(genre => targetTags.includes(genre)))
    );
    console.log(`[PlayMatch] Found ${filteredGames.length} games matching mood: ${mood}`);

    // 6. --- TODO: Send to Gemini for Smart Recommendation ---

    res.json({
      requestedIdentifier: identifier,
      resolvedSteamId: steamId64,
      requestedMood: mood,
      matchingGamesCount: filteredGames.length,
      recommendations: filteredGames.slice(0, 20), // Return only first 20 matches for brevity
    });

  } catch (error) {
    // Enhanced error handling
    if (error.response) {
        // Errors from external APIs (Steam, RAWG)
        console.error(`[API Error] Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
        if (error.response.status === 401 || error.response.status === 403) {
             return res.status(500).json({ error: 'Server configuration error: Invalid API Key.' });
        }
    } else if (error.request) {
        // Request made but no response received
        console.error('[Network Error] No response received:', error.request);
         return res.status(503).json({ error: 'Service Unavailable: Could not reach external API.' });
    } else {
        // Other errors
        console.error('[Internal Error]', error.message);
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;