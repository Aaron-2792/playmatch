// server/routes/api.js

const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const router = express.Router();

const Game = require('../models/Game');

// --- API Keys ---
const STEAM_API_KEY = process.env.STEAM_API_KEY;
const RAWG_API_KEY = process.env.RAWG_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const STEAM_API_BASE = 'http://api.steampowered.com';
const RAWG_API_URL = 'https://api.rawg.io/api/games';

// Initialize Gemini with the model that works for your Free Tier
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

router.get('/recommendations/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { mood } = req.query; // "mood" is now the User's full prompt
    let steamId64;

    if (!mood) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }
    console.log(`[PlayMatch] Request: Identifier=${identifier}`);
    console.log(`[PlayMatch] User Prompt: "${mood}"`);

    // 1. --- Resolve Identifier ---
    if (/^7656\d{13}$/.test(identifier)) {
      steamId64 = identifier;
    } else {
      console.log(`[PlayMatch] Resolving Vanity URL: ${identifier}...`);
      const resolveUrl = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v0001/`;
      try {
        const resolveResponse = await axios.get(resolveUrl, {
          params: { key: STEAM_API_KEY, vanityurl: identifier },
        });

        if (resolveResponse.data.response?.success === 1) {
          steamId64 = resolveResponse.data.response.steamid;
          console.log(`[PlayMatch] Resolved to SteamID: ${steamId64}`);
        } else {
          return res.status(404).json({ error: `Could not find Steam profile for "${identifier}".` });
        }
      } catch (err) {
        return res.status(500).json({ error: 'Failed to resolve Steam custom URL.' });
      }
    }

    // 2. --- Fetch Owned Games ---
    console.log(`[PlayMatch] Fetching games for ${steamId64}...`);
    const ownedGamesUrl = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/`;
    const steamResponse = await axios.get(ownedGamesUrl, {
      params: {
        key: STEAM_API_KEY,
        steamid: steamId64,
        format: 'json',
        include_appinfo: 1,
        include_played_free_games: 1
      },
    });

    if (!steamResponse.data.response?.games) {
      return res.status(404).json({ error: 'Profile is private or invalid.' });
    }

    const allGames = steamResponse.data.response.games;
    // Process top 40 games to give the AI more options
    const gamesToProcess = allGames.slice(0, 40);
    let detailedGames = [];

    // 3. --- Fetch Details (Cache or RAWG) ---
    console.log(`[PlayMatch] Processing top ${gamesToProcess.length} games...`);

    await Promise.all(
      gamesToProcess.map(async (steamGame) => {
        try {
          let game = await Game.findOne({ appId: steamGame.appid });

          if (!game) {
            const rawgResponse = await axios.get(RAWG_API_URL, {
              params: { key: RAWG_API_KEY, search: steamGame.name, page_size: 1 },
            });
            const rawgData = rawgResponse.data.results[0];

            if (rawgData) {
              game = new Game({
                appId: steamGame.appid,
                name: rawgData.name,
                tags: rawgData.tags ? rawgData.tags.map(t => t.slug) : [],
                genres: rawgData.genres ? rawgData.genres.map(g => g.slug) : [],
                description: rawgData.description_raw,
                backgroundImage: rawgData.background_image,
              });
              await game.save();
            }
          }
          if (game) detailedGames.push(game);
        } catch (err) {
          // Ignore individual fetch errors
        }
      })
    );

    // 4. --- AI Analysis (The "Smart" Part) ---
    console.log(`[PlayMatch] Sending ${detailedGames.length} games to Gemini...`);

    const gamesPayload = detailedGames.map(g => ({
      name: g.name,
      tags: g.tags.slice(0, 5), // Provide tags so AI knows the genre
      genres: g.genres
    }));

    const prompt = `
      You are an expert video game curator.
      
      USER REQUEST: "${mood}"
      
      Here is the user's game library:
      ${JSON.stringify(gamesPayload)}

      INSTRUCTIONS:
      1. Analyze the user's request. It might be a mood, a specific mechanic, a time constraint, or a vague feeling.
      2. Select the top 3 games from their library that BEST match this request.
      3. If the user asks for something they don't have (e.g. "racing game" but they only own shooters), pick the closest alternative and explain why.
      4. Write a custom "reason" for each game that directly addresses the user's prompt.

      OUTPUT FORMAT (JSON ONLY):
      {
        "recommendations": [
          { "name": "Game Name", "reason": "Specific explanation connecting the game to the prompt." },
          { "name": "Game Name", "reason": "Specific explanation connecting the game to the prompt." },
          { "name": "Game Name", "reason": "Specific explanation connecting the game to the prompt." }
        ]
      }
    `;

    const aiResult = await model.generateContent(prompt);
    const responseText = aiResult.response.text();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    res.json({
      user_id: steamId64,
      prompt: mood,
      recommendations: data.recommendations
    });

  } catch (error) {
    console.error(`[PlayMatch Error] ${error.message}`);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;