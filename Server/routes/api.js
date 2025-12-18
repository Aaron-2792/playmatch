// server/routes/api.js
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const router = express.Router();

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STEAM_API_BASE = 'http://api.steampowered.com';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 1. SMART SYNONYMS (The "Search Dictionary") ---
const TAG_SYNONYMS = {
  "shooter": ["shooter", "fps", "first-person shooter", "third-person shooter", "sniper", "bullet hell", "shoot 'em up", "looter shooter", "tactical"],
  "story": ["story rich", "narrative", "visual novel", "rpg", "adventure", "interactive fiction", "lore", "choose your own adventure"],
  "scary": ["horror", "survival horror", "psychological horror", "zombies", "dark", "jump scare"],
  "multiplayer": ["multiplayer", "co-op", "coop", "online co-op", "local co-op", "mmo", "pvp", "online pvp", "team-based"],
  "chill": ["relaxing", "casual", "simulation", "walking simulator", "puzzle", "family friendly", "farming sim"],
  "cars": ["racing", "driving", "automobile sim", "sports"],
  "fight": ["fighting", "beat 'em up", "martial arts", "2d fighter", "competitive"],
  "space": ["space", "sci-fi", "science fiction", "space sim", "aliens"]
};

// --- 2. POPULAR GAMES FIX (The "Manual Override") ---
// Fixes games that are missing tags in free CSV datasets
const POPULAR_GAMES_FIX = {
  "10": ["action", "fps", "shooter", "competitive", "classic"], // Counter-Strike
  "730": ["action", "fps", "shooter", "competitive", "esports"], // CS:GO
  "240": ["action", "fps", "shooter", "classic"], // CS Source
  "440": ["action", "fps", "shooter", "hero shooter", "multiplayer"], // Team Fortress 2
  "570": ["action", "moba", "strategy", "multiplayer", "competitive"], // Dota 2
  "578080": ["action", "fps", "shooter", "battle royale", "survival"], // PUBG
  "271590": ["action", "open world", "crime", "shooter", "third-person shooter"], // GTA V
  "359550": ["action", "fps", "shooter", "tactical"], // R6 Siege
  "252490": ["survival", "open world", "crafting", "multiplayer", "fps"], // Rust
  "1172470": ["action", "fps", "shooter", "battle royale", "hero shooter"], // Apex Legends
  "230410": ["action", "frame", "ninja", "shooter", "third-person shooter"], // Warframe
  "105600": ["sandbox", "adventure", "survival", "crafting"], // Terraria
  "252950": ["action", "sports", "competitive", "driving", "cars"], // Rocket League
  "292030": ["rpg", "open world", "story rich", "fantasy"], // Witcher 3
  "1085660": ["action", "adventure", "story rich", "scary", "horror"], // Destiny 2
  "397540": ["shooter", "looter shooter", "fps", "action", "rpg"], // Borderlands 3
  "49520": ["shooter", "looter shooter", "fps", "action", "rpg"], // Borderlands 2
  "218620": ["action", "heist", "shooter", "fps", "co-op"], // Payday 2
  "550": ["action", "fps", "shooter", "zombies", "co-op"], // Left 4 Dead 2
  "220": ["action", "fps", "shooter", "sci-fi", "story rich"] // Half-Life 2
};

// --- 3. LOAD CSV DATABASE ---
const METADATA_PATH = path.join(__dirname, '../steam_metadata.csv');
let GAME_DB = {};
let IS_DB_READY = false;

console.log("[PlayMatch] Starting to load CSV data...");

fs.createReadStream(METADATA_PATH)
  .pipe(csv())
  .on('data', (row) => {
    const appId = row.AppID || row.appid;
    const name = row.Name || row.name;

    // MAGNET LOGIC: Grab all text columns
    const tagString = row.Tags || row.tags || "";
    const genreString = row.Genres || row.genres || "";
    const catString = row.Categories || row.categories || "";

    const rawList = `${tagString},${genreString},${catString}`;

    let tags = [];
    if (rawList) {
      tags = rawList.split(/[,;]/)
        .map(t => t.trim())
        .filter(t => t.length > 0 && t !== '0');
    }

    if (appId) {
      // Store ID as string for easy lookup
      GAME_DB[String(appId)] = {
        name: name,
        tags: [...new Set(tags)]
      };
    }
  })
  .on('end', () => {
    IS_DB_READY = true;
    console.log(`\n[PlayMatch] ✅ SYSTEM READY! Loaded metadata for ${Object.keys(GAME_DB).length} games.`);
  });

// --- HELPER: Shuffle ---
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
    const { mood } = req.query;
    let steamId64;

    if (!IS_DB_READY) return res.status(503).json({ error: 'Server booting. Try again in 5 seconds.' });
    if (!mood) return res.status(400).json({ error: 'Prompt is required.' });

    // --- 4. Resolve Identifier ---
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

    // --- 5. Fetch Owned Games ---
    const ownedGamesUrl = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/`;
    const steamResponse = await axios.get(ownedGamesUrl, {
      params: { key: STEAM_API_KEY, steamid: steamId64, format: 'json', include_appinfo: 1, include_played_free_games: 1 },
    });

    if (!steamResponse.data.response?.games) {
      return res.status(404).json({ error: 'Library is private or empty.' });
    }

    // --- 6. ENRICH DATA (Apply Manual Fixes Here) ---
    const enrichedGames = steamResponse.data.response.games.map(game => {
      const appIdString = String(game.appid);

      // CHECK 1: Is it in our Popular Fix List? (Priority)
      let finalTags = POPULAR_GAMES_FIX[appIdString];

      // CHECK 2: If not, check the CSV
      if (!finalTags) {
        const localData = GAME_DB[appIdString];
        finalTags = localData ? localData.tags : [];
      }

      return {
        appid: game.appid,
        name: game.name,
        playtime_hours: Math.round(game.playtime_forever / 60),
        tags: finalTags
      };
    }).filter(g => g.playtime_hours > 0.5);


    // --- 7. DECISION ENGINE ---
    let finalRecommendations = [];
    const promptLower = mood.trim().toLowerCase();

    // Get search terms
    const searchTerms = TAG_SYNONYMS[promptLower] || [promptLower];
    console.log(`\n[DEBUG] Searching for: "${promptLower}" using terms:`, searchTerms);

    // Filter Logic
    const exactMatches = enrichedGames.filter(g => {
      // Check Tags
      const hasTag = g.tags && g.tags.some(tag => searchTerms.some(term => tag.toLowerCase().includes(term)));
      // Check Name (e.g. "Alien Shooter")
      const hasName = g.name.toLowerCase().includes(promptLower);
      return hasTag || hasName;
    });

    if (exactMatches.length >= 3) {
      console.log(`[PlayMatch] Found ${exactMatches.length} local matches! Skipping AI.`);
      const selected = shuffleArray(exactMatches).slice(0, 9);

      finalRecommendations = selected.map(g => {
        const matchedTag = g.tags.find(tag => searchTerms.some(term => tag.toLowerCase().includes(term)));
        const reason = matchedTag
          ? `Matches your request for "${mood}" (Found tag: ${matchedTag})`
          : `Matches your request because "${mood}" is in the title.`;

        return { appid: g.appid, name: g.name, reason: reason };
      });
    } else {
      console.log(`[PlayMatch] Only found ${exactMatches.length} matches. Asking Gemini...`);
      const sample = shuffleArray(enrichedGames).slice(0, 150);

      const aiPrompt = `
        User Request: "${mood}"
        Library Sample: ${JSON.stringify(sample)}
        Pick top 9 games matching the request. Return JSON with 'recommendations' array (appid, name, reason).
      `;

      const result = await model.generateContent(aiPrompt);
      const cleanJson = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanJson);
      finalRecommendations = data.recommendations;
    }

    // --- 8. ADD IMAGES ---
    const resultWithImages = finalRecommendations.map(rec => ({
      ...rec,
      image: `https://steamcdn-a.akamaihd.net/steam/apps/${rec.appid}/header.jpg`
    }));

    res.json({ recommendations: resultWithImages });

  } catch (error) {
    console.error(`[PlayMatch Error]`, error.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;