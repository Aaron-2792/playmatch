// server/routes/api.js
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const router = express.Router();

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STEAM_API_BASE = 'http://api.steampowered.com';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 1. MONGO SCHEMA ---
const GameSchema = new mongoose.Schema({
  appid: String,
  name: String,
  tags: [String]
});
const SteamGame = mongoose.models.SteamGame || mongoose.model('SteamGame', GameSchema);

// --- 2. TAG DEFINITIONS ---
const TAG_SYNONYMS = {
  "shooter": ["shooter", "fps", "first-person shooter", "third-person shooter", "sniper", "bullet hell", "shoot 'em up", "looter shooter", "tactical"],
  "story": ["story rich", "narrative", "visual novel", "rpg", "adventure", "interactive fiction", "lore", "choose your own adventure"],
  "scary": ["horror", "survival horror", "psychological horror", "zombies", "dark", "jump scare"],
  "multiplayer": ["multiplayer", "co-op", "coop", "online co-op", "local co-op", "mmo", "pvp", "online pvp", "team-based"],
  "chill": ["relaxing", "casual", "simulation", "walking simulator", "puzzle", "family friendly", "farming sim"],
  "adult": ["nudity", "sexual content", "hentai", "nsfw", "adult only", "ecchi", "erotic", "mature", "romance", "dating sim"]
};

const ADULT_KEYWORDS = ["nudity", "sexual", "hentai", "nsfw", "adult only", "ecchi", "erotic"];

// --- 3. POPULAR GAMES FIX ---
const POPULAR_GAMES_FIX = {
  "10": ["action", "fps", "shooter", "competitive"],
  "730": ["action", "fps", "shooter", "competitive"],
  "440": ["action", "fps", "shooter", "multiplayer"],
  "570": ["action", "moba", "strategy", "multiplayer"],
  "271590": ["action", "open world", "crime", "shooter"],
  "359550": ["action", "fps", "shooter", "tactical"],
  "1172470": ["action", "fps", "shooter", "battle royale"],
  "252950": ["action", "sports", "competitive", "driving"],
};

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

router.get('/recommendations/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { mood, includeAdult } = req.query;
    let steamId64;

    if (!mood) return res.status(400).json({ error: 'Prompt is required.' });

    // --- Resolve ID ---
    if (/^7656\d{13}$/.test(identifier)) {
      steamId64 = identifier;
    } else {
      const resolveUrl = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v0001/`;
      try {
        const resolveResponse = await axios.get(resolveUrl, { params: { key: STEAM_API_KEY, vanityurl: identifier } });
        if (resolveResponse.data.response?.success === 1) {
          steamId64 = resolveResponse.data.response.steamid;
        } else {
          return res.status(404).json({ error: "User not found" });
        }
      } catch (err) {
        return res.status(500).json({ error: 'Steam API Error' });
      }
    }

    const ownedGamesUrl = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/`;
    const steamResponse = await axios.get(ownedGamesUrl, {
      params: { key: STEAM_API_KEY, steamid: steamId64, format: 'json', include_appinfo: 1, include_played_free_games: 1 },
    });

    if (!steamResponse.data.response?.games) {
      return res.status(404).json({ error: 'Library is private or empty.' });
    }

    let userGames = steamResponse.data.response.games;

    // --- Batch Query MongoDB ---
    const appIds = userGames.map(g => String(g.appid));
    const gamesFromDb = await SteamGame.find({ appid: { $in: appIds } }).lean();

    const dbMap = {};
    gamesFromDb.forEach(g => { dbMap[g.appid] = g.tags; });

    let enrichedGames = userGames.map(game => {
      const appIdString = String(game.appid);
      let finalTags = POPULAR_GAMES_FIX[appIdString];
      if (!finalTags) finalTags = dbMap[appIdString] || [];

      return {
        appid: game.appid,
        name: game.name,
        playtime_hours: Math.round(game.playtime_forever / 60),
        tags: finalTags
      };
    }).filter(g => g.playtime_hours > 0.5);

    // --- DEBUG: LOG TAGS ---
    // This will print to your terminal so you can see if the tags are missing!
    console.log("\n[DEBUG] Sample Game Tags from DB:",
      enrichedGames.slice(0, 3).map(g => `${g.name}: [${g.tags.join(', ')}]`)
    );

    // --- FILTER: Remove Adult Content if Unchecked ---
    if (includeAdult !== 'true') {
      enrichedGames = enrichedGames.filter(g => {
        if (!g.tags) return true;
        const hasAdultTag = g.tags.some(tag => {
          const lowerTag = tag.toLowerCase();
          return ADULT_KEYWORDS.some(keyword => lowerTag.includes(keyword));
        });
        return !hasAdultTag;
      });
    }

    // --- DECISION ENGINE ---
    let finalRecommendations = [];
    let promptLower = mood.trim().toLowerCase();

    const isAdultSearch = ADULT_KEYWORDS.some(k => promptLower.includes(k)) || promptLower === 'adult';
    const searchTerms = TAG_SYNONYMS[promptLower] || (isAdultSearch ? ADULT_KEYWORDS : [promptLower]);

    console.log(`\n[DEBUG] Search: "${promptLower}" | Adult: ${includeAdult} | AI Bypass: ${isAdultSearch}`);

    const exactMatches = enrichedGames.filter(g => {
      const hasTag = g.tags && g.tags.some(tag => searchTerms.some(term => tag.toLowerCase().includes(term)));
      const hasName = g.name.toLowerCase().includes(promptLower);
      return hasTag || hasName;
    });

    // 1. Try Local First
    if (exactMatches.length >= 3) {
      console.log(`[PlayMatch] Found ${exactMatches.length} local matches.`);
      const selected = shuffleArray(exactMatches).slice(0, 9);
      finalRecommendations = selected.map(g => ({
        appid: g.appid,
        name: g.name,
        reason: `Matches your request for "${mood}"`
      }));
    } else {
      // 2. If Local Failed, Prepare AI Prompt
      console.log(`[PlayMatch] Local failed (Found ${exactMatches.length}). Asking Gemini...`);

      // --- SANITIZE PROMPT FOR ADULT SEARCHES ---
      // If the user wants "Adult" but local failed, we ask Gemini for "Romance" to avoid the crash.
      let safeMood = mood;
      if (isAdultSearch) {
        console.log("[PlayMatch] Sanitizing 'Adult' prompt for Gemini safety...");
        safeMood = "Romance, Visual Novel, Mature Story, Dating Sim";
      }

      const sample = shuffleArray(enrichedGames).slice(0, 150);
      const aiPrompt = `
        User Request: "${safeMood}"
        Library Sample: ${JSON.stringify(sample)}
        Pick top 9 games matching the request. Return JSON with 'recommendations' array (appid, name, reason).
      `;

      try {
        const result = await model.generateContent(aiPrompt);
        const cleanJson = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        if (!cleanJson.startsWith('{')) throw new Error("AI Refusal");
        const data = JSON.parse(cleanJson);
        finalRecommendations = data.recommendations;
      } catch (aiError) {
        console.log("[PlayMatch] Gemini Failed. Falling back to random.");
        const randomBackup = shuffleArray(enrichedGames).slice(0, 9);
        finalRecommendations = randomBackup.map(g => ({
          appid: g.appid,
          name: g.name,
          reason: "AI unavailable - Here is a random pick!"
        }));
      }
    }

    // --- Add Images ---
    const resultWithImages = finalRecommendations.map(rec => ({
      ...rec,
      image: rec.image || `https://steamcdn-a.akamaihd.net/steam/apps/${rec.appid}/header.jpg`
    }));

    res.json({ recommendations: resultWithImages });

  } catch (error) {
    console.error(`[PlayMatch Error]`, error.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;