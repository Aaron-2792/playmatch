const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const router = express.Router();

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STEAM_API_BASE = 'http://api.steampowered.com';
const STEAM_STORE_API_BASE = 'https://store.steampowered.com/api';
const GEMINI_MODEL = 'gemini-3.5-flash';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

const aiSearchLimiter = rateLimit({
  windowMs: 900000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI search requests. Please try again in 15 minutes.' }
});

// --- 1. MONGO SCHEMA ---
const GameSchema = new mongoose.Schema({
  appid: String,
  name: String,
  tags: [String]
});
const SteamGame = mongoose.models.SteamGame || mongoose.model('SteamGame', GameSchema);

// --- 2. TAG DEFINITIONS (TUNED & EXPANDED) ---
const TAG_SYNONYMS = {
  // --- GENRES ---
  "shooter": ["shooter", "fps", "first-person shooter", "third-person shooter", "sniper", "shoot 'em up", "looter shooter", "tactical shooter", "boomer shooter"],
  "fps": ["fps", "shooter", "first-person shooter", "first-person", "hero shooter"],
  "rpg": ["rpg", "role-playing", "jrpg", "crpg", "action rpg", "adventure"],
  "action": ["action", "action-adventure", "hack and slash", "beat 'em up"],
  "strategy": ["strategy", "rts", "real-time strategy", "turn-based strategy", "grand strategy", "4x", "tactical", "tower defense"],
  "moba": ["moba", "multiplayer online battle arena", "dota", "action rts"],
  "mmo": ["mmo", "mmorpg", "massively multiplayer"],
  "roguelike": ["roguelike", "rogue-lite", "rogue", "dungeon crawler", "permadeath"],
  "metroidvania": ["metroidvania", "platformer", "exploration", "2d"],
  "platformer": ["platformer", "precision platformer", "3d platformer", "2d platformer", "side scroller"],
  "fighting": ["fighting", "beat 'em up", "martial arts", "2d fighter", "arena fighter", "brawler"],
  "racing": ["racing", "driving", "automobile", "sim racing", "arcade racing", "rally", "formula"],
  "sports": ["sports", "football", "soccer", "basketball", "baseball", "hockey", "skateboarding", "extreme sports"],
  "puzzle": ["puzzle", "logic", "hidden object", "physics", "mystery", "investigation"],
  "simulation": ["simulation", "sim", "immersive sim", "farming sim", "life sim", "sandbox"],
  "survival": ["survival", "survival horror", "crafting", "open world survival craft"],
  "horror": ["horror", "survival horror", "psychological horror", "jump scare", "zombies", "scary"],
  "battle royale": ["battle royale", "pvp", "survival", "last man standing"],
  "visual novel": ["visual novel", "anime", "story rich", "choose your own adventure", "text-based"],

  // --- VIBES & MOODS ---
  "cozy": ["cozy", "relaxing", "casual", "wholesome", "farming sim", "life sim", "chill", "cute"],
  "relaxing": ["relaxing", "chill", "casual", "walking simulator", "atmospheric", "exploration"],
  "chaos": ["physics", "destruction", "sandbox", "action", "mayhem", "funny"],
  "rage-quit": ["difficult", "precision platformer", "souls-like", "permadeath", "hardcore"],
  "hardcore": ["difficult", "masterpiece", "souls-like", "complex", "competitive"],
  "casual": ["casual", "family friendly", "arcade", "minigames", "simple"],
  "competitive": ["competitive", "esports", "pvp", "ranked", "multiplayer"],
  "funny": ["funny", "comedy", "parody", "memes", "satire"],
  "dark": ["dark", "grim", "gothic", "noir", "atmospheric", "dystopian"],
  "wholesome": ["wholesome", "cute", "relaxing", "family friendly", "emotional"],
  "atmospheric": ["atmospheric", "exploration", "walking simulator", "immersive", "soundtrack"],
  "story rich": ["story rich", "narrative", "lore-rich", "interactive fiction", "choices matter", "great soundtrack"],
  "fast-paced": ["fast-paced", "action", "fps", "hack and slash", "bullet hell", "boomer shooter"],
  "slow burn": ["strategy", "rpg", "grand strategy", "turn-based", "simulation"],
  "nostalgia": ["classic", "retro", "pixel art", "old school", "arcade", "remake"],

  // --- THEMES ---
  "cyberpunk": ["cyberpunk", "sci-fi", "futuristic", "hacker", "dystopian", "high tech"],
  "steampunk": ["steampunk", "victorian", "fantasy", "industrial"],
  "sci-fi": ["sci-fi", "science fiction", "space", "futuristic", "aliens", "robots"],
  "space": ["space", "sci-fi", "spaceship", "flight", "exploration"],
  "fantasy": ["fantasy", "magic", "dragons", "medieval", "mythology", "dark fantasy"],
  "medieval": ["medieval", "swordplay", "historical", "fantasy", "knights"],
  "zombies": ["zombies", "undead", "survival", "horror", "outbreak"],
  "vampires": ["vampire", "gothic", "supernatural", "horror"],
  "post-apocalyptic": ["post-apocalyptic", "survival", "wasteland", "dystopian", "scavenging"],
  "military": ["military", "war", "tactical", "shooter", "realistic", "tank"],
  "aliens": ["aliens", "sci-fi", "space", "horror"],
  "noir": ["noir", "detective", "crime", "mystery", "thriller", "dark"],
  "mystery": ["mystery", "detective", "investigation", "puzzle", "crime"],

  // --- MECHANICS & TECH ---
  "open world": ["open world", "exploration", "sandbox", "adventure"],
  "sandbox": ["sandbox", "open world", "building", "physics", "crafting"],
  "crafting": ["crafting", "survival", "building", "sandbox"],
  "turn-based": ["turn-based", "turn-based strategy", "turn-based combat", "jrpg", "card game"],
  "hack & slash": ["hack and slash", "action", "beat 'em up", "spectacle fighter"],
  "looter shooter": ["looter shooter", "loot", "shooter", "grind"],
  "stealth": ["stealth", "assassin", "thief", "tactical"],
  "co-op": ["co-op", "online co-op", "local co-op", "multiplayer", "team-based"],
  "pvp": ["pvp", "multiplayer", "competitive", "online pvp"],
  "vr": ["vr", "virtual reality", "vr only"],
  "pixel art": ["pixel art", "retro", "2d", "indie", "8-bit", "16-bit"]
};

const QUICK_PICK_TAG_GROUPS = {
  ...TAG_SYNONYMS,
  action: ['action', 'action-adventure', 'hack and slash', 'beat em up', 'brawler'],
  rpg: ['rpg', 'role-playing', 'jrpg', 'crpg', 'action rpg', 'adventure'],
  strategy: ['strategy', 'real-time strategy', 'turn-based strategy', '4x', 'tactical'],
  'co op': ['co-op', 'online co-op', 'local co-op', 'multiplayer', 'split screen', 'team-based'],
  'sci fi': ['sci-fi', 'science fiction', 'space', 'futuristic', 'aliens', 'robots'],
  horror: ['horror', 'survival horror', 'psychological horror', 'jump scare', 'zombies', 'scary'],
  cozy: ['cozy', 'relaxing', 'casual', 'wholesome', 'farming sim', 'life sim', 'chill', 'cute'],
  simulation: ['simulation', 'sim', 'immersive sim', 'farming sim', 'life sim', 'sandbox'],
  fps: ['fps', 'shooter', 'first-person shooter', 'first-person', 'hero shooter'],
  'open world': ['open world', 'exploration', 'sandbox', 'adventure'],
  survival: ['survival', 'survival horror', 'crafting', 'open world survival craft'],
  indie: ['indie', 'independent', 'pixel art', 'retro'],
  roguelike: ['roguelike', 'rogue-lite', 'rogue', 'dungeon crawler', 'permadeath'],
  platformer: ['platformer', 'precision platformer', '3d platformer', '2d platformer', 'side scroller'],
  puzzle: ['puzzle', 'logic', 'hidden object', 'physics', 'mystery', 'investigation'],
  'story rich': ['story rich', 'narrative', 'lore-rich', 'interactive fiction', 'choices matter'],
  casual: ['casual', 'family friendly', 'arcade', 'minigames', 'simple'],
  cyberpunk: ['cyberpunk', 'sci-fi', 'futuristic', 'hacker', 'dystopian', 'high tech'],
  'card board': ['card game', 'deckbuilding', 'board game', 'tabletop', 'strategy'],
  'sports racing': ['sports', 'racing', 'driving', 'automobile', 'sim racing', 'football', 'soccer'],
  '15 min quick hit': ['arcade', 'casual', 'fighting', 'roguelike', 'platformer'],
  '1 hour session': ['action', 'fps', 'puzzle', 'indie'],
  'all night binge': ['rpg', 'open world', 'strategy', 'simulation', 'mmo']
};

const RESTRICTED_KEYWORDS = ["nudity", "sexual", "hentai", "nsfw", "adult only", "ecchi", "erotic", "18+"];
const BANNED_TITLE_WORDS = ["sakura", "sex", "hentai", "nude", "uncensored", "breeding", "lewd", "oppai", "ecchi", "porn"];

// --- 3. FLAVOR TEXT TEMPLATES ---
const REASON_TEMPLATES = [
  "A perfect fit for your {mood} craving.",
  "One of the best {mood} games in your collection.",
  "If you want {mood}, you can't go wrong with this.",
  "A classic choice for {mood} fans.",
  "Hit play on this if you need some {mood} action.",
  "Your library's top pick for {mood} right now."
];

// --- 4. POPULAR GAMES FIX ---
const POPULAR_GAMES_FIX = {
  "10": ["action", "fps", "shooter", "competitive", "classic"],
  "730": ["action", "fps", "shooter", "competitive", "esports"],
  "440": ["action", "fps", "shooter", "hero shooter", "multiplayer"],
  "570": ["action", "moba", "strategy", "multiplayer", "competitive"],
  "271590": ["action", "open world", "crime", "shooter", "third-person shooter"],
  "359550": ["action", "fps", "shooter", "tactical"],
  "252490": ["survival", "open world", "crafting", "multiplayer", "fps"],
  "1172470": ["action", "fps", "shooter", "battle royale", "hero shooter"],
  "230410": ["action", "frame", "ninja", "shooter", "third-person shooter"],
  "252950": ["action", "racing", "competitive", "driving", "cars"],
  "292030": ["rpg", "open world", "story rich", "fantasy"],
  "1085660": ["action", "adventure", "story rich", "scary", "horror"],
  "397540": ["shooter", "looter shooter", "fps", "action", "rpg"],
  "550": ["action", "fps", "shooter", "zombies", "co-op"],
};

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getFlavorText(mood) {
  const template = REASON_TEMPLATES[Math.floor(Math.random() * REASON_TEMPLATES.length)];
  return template.replace("{mood}", mood);
}
// --- STEAM ID VALIDATION ---
function validateSteamId(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return { valid: false, error: 'Invalid Steam ID format.' };
  }
  
  // Check if it's a SteamID64 (should be exactly 17 digits starting with 7656)
  if (/^7656\d{13}$/.test(identifier)) {
    return { valid: true, steamId64: identifier };
  }
  
  // If not a direct SteamID64, it should be treated as a vanity URL
  // Vanity URLs are alphanumeric and can contain underscores
  if (/^[a-zA-Z0-9_-]{2,32}$/.test(identifier)) {
    return { valid: true, isVanity: true, vanityUrl: identifier };
  }
  
  return { valid: false, error: 'Invalid Steam ID. Please enter a valid 17-digit SteamID64 or Steam vanity URL.' };
}

// --- 5. SAFETY & HALLUCINATION CHECK ---
function isExplicitContent(title, tags = []) {
  if (!title) return false;
  const titleLower = title.toLowerCase();
  const safeTags = Array.isArray(tags) ? tags : [];
  const tagsLower = safeTags.map(t => t ? t.toLowerCase() : "");

  const hasBannedWord = BANNED_TITLE_WORDS.some(badWord => titleLower.includes(badWord));
  const hasBannedTag = tagsLower.some(tag =>
    RESTRICTED_KEYWORDS.some(keyword => tag.includes(keyword))
  );

  return hasBannedWord || hasBannedTag;
}

function validateAIRecommendations(aiRecommendations, userLibrary) {
  const validGamesMap = new Map();
  userLibrary.forEach(g => validGamesMap.set(String(g.appid), g));

  return aiRecommendations.filter(rec => {
    const appIdStr = String(rec.appid);
    const actualGame = validGamesMap.get(appIdStr);

    if (!actualGame) {
      console.log(`[HALLUCINATION] Blocked game not in library: ${rec.name} (${rec.appid})`);
      return false;
    }

    if (isExplicitContent(actualGame.name, actualGame.tags)) {
      console.log(`[SAFETY] Blocked explicit game: ${rec.name}`);
      return false;
    }
    return true;
  });
}

function minutesToHours(minutes = 0) {
  return Math.round((minutes / 60) * 10) / 10;
}

function getPlaytimeMetrics(game) {
  const playtime_forever = game.playtime_forever || 0;
  const playtime_2weeks = game.playtime_2weeks || 0;

  return {
    playtime_forever,
    playtime_2weeks,
    playtime_hours: minutesToHours(playtime_forever),
    playtime_2weeks_hours: minutesToHours(playtime_2weeks)
  };
}

function normalizeTag(value) {
  return String(value).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

function levenshteinDistance(first, second) {
  const previousRow = Array.from({ length: second.length + 1 }, (_, index) => index);

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    let previousDiagonal = previousRow[0];
    previousRow[0] = firstIndex;

    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const current = previousRow[secondIndex];
      previousRow[secondIndex] = Math.min(
        previousRow[secondIndex] + 1,
        previousRow[secondIndex - 1] + 1,
        previousDiagonal + (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1)
      );
      previousDiagonal = current;
    }
  }

  return previousRow[second.length];
}

function isFuzzyTagMatch(tag, searchTerm) {
  if (tag.includes(searchTerm) || searchTerm.includes(tag)) return true;

  const maximumDistance = Math.max(1, Math.floor(Math.max(tag.length, searchTerm.length) * 0.2));
  return levenshteinDistance(tag, searchTerm) <= maximumDistance;
}

function matchesQuickPick(tags = [], vibe) {
  const normalizedVibe = normalizeTag(vibe);
  const searchTerms = (QUICK_PICK_TAG_GROUPS[normalizedVibe] || [normalizedVibe]).map(normalizeTag);

  return tags.some(tag => {
    const normalizedTag = normalizeTag(tag);
    return searchTerms.some(searchTerm => isFuzzyTagMatch(normalizedTag, searchTerm));
  });
}

async function getSteamArtwork(appId, fallbackHeaderImage) {
  try {
    const response = await axios.get(`${STEAM_STORE_API_BASE}/appdetails`, {
      params: { appids: appId, l: 'english' },
      timeout: 5000
    });
    const appDetails = response.data[String(appId)];
    const gameData = appDetails?.success ? appDetails.data : null;

    return {
      headerImage: gameData?.header_image || fallbackHeaderImage,
      backgroundImage: gameData?.background || gameData?.screenshots?.[0]?.path_full || fallbackHeaderImage
    };
  } catch (error) {
    console.warn(`[PlayMatch] Could not load Steam artwork for app ${appId}: ${error.message}`);
    return { headerImage: fallbackHeaderImage, backgroundImage: fallbackHeaderImage };
  }
}

async function addSteamArtwork(recommendations, userLibrary) {
  const playtimeByAppId = new Map(
    userLibrary.map(game => [String(game.appid), getPlaytimeMetrics(game)])
  );

  return Promise.all(recommendations.map(async recommendation => {
    const image = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${recommendation.appid}/header.jpg`;
    const artwork = await getSteamArtwork(recommendation.appid, image);
    return {
      ...recommendation,
      image: artwork.headerImage,
      ...playtimeByAppId.get(String(recommendation.appid)),
      ...artwork
    };
  }));
}

function getErrorStatus(error) {
  return Number(error?.status || error?.response?.status || error?.code);
}

function isRetryableGeminiError(error) {
  const status = getErrorStatus(error);
  return status === 429 || status === 503;
}

async function generateGeminiContent(prompt) {
  let lastError;

  for (let retry = 0; retry <= 3; retry += 1) {
    try {
      return await model.generateContent(prompt);
    } catch (error) {
      lastError = error;

      if (!isRetryableGeminiError(error) || retry === 3) {
        break;
      }

      const delayMs = 1000 * 2 ** retry;
      console.warn(`[PlayMatch] ${GEMINI_MODEL} request failed; retrying in ${delayMs}ms.`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

// --- ROUTE 1: RECOMMENDATIONS (AI SEARCH) ---
router.get('/recommendations/:identifier', aiSearchLimiter, async (req, res) => {
  try {
    const { identifier } = req.params;
    const { mood, showUnplayedOnly } = req.query;
    let steamId64;

    if (!mood) return res.status(400).json({ error: 'Prompt is required.' });

    // --- SAFETY CHECK (Input) ---
    const promptLower = mood.trim().toLowerCase();
    if (isExplicitContent(promptLower)) {
      return res.status(400).json({
        error: "PlayMatch is a professional portfolio project. Adult/NSFW content is not supported."
      });
    }

    // --- Validate & Resolve ID ---
    const idValidation = validateSteamId(identifier);
    if (!idValidation.valid) {
      return res.status(400).json({ error: idValidation.error });
    }

    if (idValidation.steamId64) {
      steamId64 = idValidation.steamId64;
    } else if (idValidation.isVanity) {
      const resolveUrl = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v0001/`;
      try {
        const resolveResponse = await axios.get(resolveUrl, { params: { key: STEAM_API_KEY, vanityurl: idValidation.vanityUrl } });
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

    const userGames = steamResponse.data.response.games.filter(game => (
      showUnplayedOnly !== 'true' || !game.playtime_forever
    ));
    const initialCount = userGames.length;
    console.log(`\n[DEBUG] Steam returned ${initialCount} total items.`);

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
        ...getPlaytimeMetrics(game),
        tags: finalTags
      };
    });

    // --- FILTER & LOGGING ---
    const explicitGames = enrichedGames.filter(g => isExplicitContent(g.name, g.tags));
    console.log(`[DEBUG] Removed ${explicitGames.length} explicit/NSFW games.`);

    enrichedGames = enrichedGames.filter(g => !isExplicitContent(g.name, g.tags));
    console.log(`[DEBUG] Final clean library size sent to AI: ${enrichedGames.length}`);

    // --- DECISION ENGINE ---
    let finalRecommendations = [];
    const searchTerms = TAG_SYNONYMS[promptLower] || [promptLower];

    // --- LOCAL SEARCH ---
    const exactMatches = enrichedGames.filter(g => {
      const hasTag = g.tags && g.tags.some(tag => searchTerms.some(term => tag.toLowerCase().includes(term)));
      const hasName = g.name.toLowerCase().includes(promptLower);
      return hasTag || hasName;
    });

    if (exactMatches.length >= 3) {
      console.log(`[PlayMatch] Found ${exactMatches.length} local matches.`);
      // --- UPDATE: Slice 12 instead of 9 ---
      const selected = shuffleArray(exactMatches).slice(0, 12);
      finalRecommendations = selected.map(g => ({
        appid: g.appid,
        name: g.name,
        reason: getFlavorText(mood)
      }));
    } else {
      console.log(`[PlayMatch] Asking Gemini...`);
      const sample = shuffleArray(enrichedGames).slice(0, 5000);

      // --- UPDATE: Prompt asks for 12 games ---
      const aiPrompt = `
        You are a gaming expert assistant.
        User Request: "${mood}"
        
        CRITICAL INSTRUCTIONS:
        1. Select top 12 games from the provided "Library Sample" JSON below.
        2. You MUST use the EXACT 'appid' from the list. Do not invent games.
        3. STRICTLY EXCLUDE Adult/Hentai/NSFW games.
        4. If you can't find 12 good matches, return fewer. Do not hallucinate.

        Library Sample:
        ${JSON.stringify(sample)}

        Output Format: JSON with 'recommendations' array (appid, name, reason).
      `;

      try {
        const result = await generateGeminiContent(aiPrompt);
        const cleanJson = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        if (!cleanJson.startsWith('{')) throw new Error("AI returned invalid JSON");

        const data = JSON.parse(cleanJson);
        const rawRecs = data.recommendations || [];

        finalRecommendations = validateAIRecommendations(rawRecs, enrichedGames);

        if (finalRecommendations.length === 0) {
          console.log("[PlayMatch] AI returned 0 valid games. Triggering fallback.");
          throw new Error("Validation returned empty list");
        }

      } catch (aiError) {
        console.log(`[PlayMatch] AI/Validation Error: ${aiError.message}`);
        if (isRetryableGeminiError(aiError)) {
          return res.status(503).json({
            error: 'Recommendations are temporarily unavailable. Please try again shortly.'
          });
        }
        // --- UPDATE: Slice 12 instead of 9 for fallback ---
        const randomBackup = shuffleArray(enrichedGames).slice(0, 12);
        finalRecommendations = randomBackup.map(g => ({
          appid: g.appid,
          name: g.name,
          reason: "Here are some random picks from your library (AI unavailable)."
        }));
      }
    }

    const resultWithImages = await addSteamArtwork(finalRecommendations, enrichedGames);

    res.json({ recommendations: resultWithImages });

  } catch (error) {
    console.error(`[PlayMatch Error]`, error.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// --- ROUTE 2: GET USER GAMES FOR ROULETTE (Optional Helper) ---
router.get('/user-games/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    let steamId64;

    // --- Validate & Resolve ID ---
    const idValidation = validateSteamId(identifier);
    if (!idValidation.valid) {
      return res.status(400).json({ error: idValidation.error });
    }

    if (idValidation.steamId64) {
      steamId64 = idValidation.steamId64;
    } else if (idValidation.isVanity) {
      const resolveUrl = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v0001/`;
      try {
        const resolveResponse = await axios.get(resolveUrl, { params: { key: STEAM_API_KEY, vanityurl: idValidation.vanityUrl } });
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

    const userGames = steamResponse.data.response.games;

    const appIds = userGames.map(g => String(g.appid));
    const gamesFromDb = await SteamGame.find({ appid: { $in: appIds } }).lean();

    const dbMap = {};
    gamesFromDb.forEach(g => { dbMap[g.appid] = g.tags; });

    const cleanGames = userGames.map(game => {
      const appIdString = String(game.appid);
      let finalTags = POPULAR_GAMES_FIX[appIdString];
      if (!finalTags) finalTags = dbMap[appIdString] || [];
      return {
        appid: game.appid,
        name: game.name,
        ...getPlaytimeMetrics(game),
        tags: finalTags,
        image: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.appid}/header.jpg`
      };
    }).filter(g => !isExplicitContent(g.name, g.tags));

    res.json({ games: cleanGames });

  } catch (error) {
    console.error(`[User Games Error]`, error.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// --- ROUTE 3: SMART QUICK PICKS (NO AI) ---
router.get('/quick-picks/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { vibe, showUnplayedOnly } = req.query;
    let steamId64;

    if (!vibe) return res.status(400).json({ error: 'Quick Pick is required.' });

    // --- Validate & Resolve ID ---
    const idValidation = validateSteamId(identifier);
    if (!idValidation.valid) {
      return res.status(400).json({ error: idValidation.error });
    }

    if (idValidation.steamId64) {
      steamId64 = idValidation.steamId64;
    } else if (idValidation.isVanity) {
      const resolveUrl = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v0001/`;
      const resolveResponse = await axios.get(resolveUrl, {
        params: { key: STEAM_API_KEY, vanityurl: idValidation.vanityUrl }
      });

      if (resolveResponse.data.response?.success !== 1) {
        return res.status(404).json({ error: 'User not found' });
      }

      steamId64 = resolveResponse.data.response.steamid;
    }

    const ownedGamesUrl = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/`;
    const steamResponse = await axios.get(ownedGamesUrl, {
      params: {
        key: STEAM_API_KEY,
        steamid: steamId64,
        format: 'json',
        include_appinfo: 1,
        include_played_free_games: 1
      }
    });

    if (!steamResponse.data.response?.games) {
      return res.status(404).json({ error: 'Library is private or empty.' });
    }

    const userGames = steamResponse.data.response.games.filter(game => (
      showUnplayedOnly !== 'true' || !game.playtime_forever
    ));
    const appIds = userGames.map(game => String(game.appid));
    const gamesFromDb = await SteamGame.find({ appid: { $in: appIds } }).lean();
    const tagsByAppId = new Map(gamesFromDb.map(game => [game.appid, game.tags]));

    const matches = userGames.map(game => {
      const appId = String(game.appid);
      const tags = POPULAR_GAMES_FIX[appId] || tagsByAppId.get(appId) || [];

      return {
        appid: game.appid,
        name: game.name,
        ...getPlaytimeMetrics(game),
        tags,
        image: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.appid}/header.jpg`,
        reason: `Matches your ${vibe} Quick Pick.`
      };
    }).filter(game => !isExplicitContent(game.name, game.tags) && matchesQuickPick(game.tags, vibe));

    res.json({ recommendations: shuffleArray(matches).slice(0, 12) });
  } catch (error) {
    console.error(`[Quick Picks Error]`, error.message);
    res.status(500).json({ error: 'Unable to filter your Steam library.' });
  }
});

// --- ROUTE 4: ROULETTE / SURPRISE ME ---
router.get('/roulette/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    let steamId64;

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

    const userGames = steamResponse.data.response.games;
    const appIds = userGames.map(g => String(g.appid));
    const gamesFromDb = await SteamGame.find({ appid: { $in: appIds } }).lean();

    const dbMap = {};
    gamesFromDb.forEach(g => { dbMap[g.appid] = g.tags; });

    const cleanGames = userGames.map(game => {
      const appIdString = String(game.appid);
      let finalTags = POPULAR_GAMES_FIX[appIdString];
      if (!finalTags) finalTags = dbMap[appIdString] || [];
      return {
        appid: game.appid,
        name: game.name,
        ...getPlaytimeMetrics(game),
        tags: finalTags
      };
    }).filter(g => !isExplicitContent(g.name, g.tags));

    console.log(`[ROULETTE] Picked from ${cleanGames.length} clean games.`);

    if (cleanGames.length === 0) {
      return res.status(404).json({ error: "No suitable games found in library." });
    }

    // Pick Winner + 9 Fillers
    const shuffled = cleanGames.sort(() => 0.5 - Math.random());
    const winner = shuffled[0];
    const fillers = shuffled.slice(1, 10);

    const result = {
      appid: winner.appid,
      name: winner.name,
      reason: "The Fates have decided! Time to play this.",
      image: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${winner.appid}/header.jpg`,
      ...getPlaytimeMetrics(winner),
      fillers: fillers.map(g => ({ name: g.name }))
    };

    res.json({ recommendation: result });

  } catch (error) {
    console.error(`[Roulette Error]`, error.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// --- ROUTE 4: USER STATS / DNA (Updated with Free Games Fix) ---
router.get('/stats/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    let steamId64;

    // 1. Validate & Resolve ID
    const idValidation = validateSteamId(identifier);
    if (!idValidation.valid) {
      return res.status(400).json({ error: idValidation.error });
    }

    if (idValidation.steamId64) {
      steamId64 = idValidation.steamId64;
    } else if (idValidation.isVanity) {
      const resolveUrl = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v0001/`;
      try {
        const resolveResponse = await axios.get(resolveUrl, { params: { key: STEAM_API_KEY, vanityurl: idValidation.vanityUrl } });
        if (resolveResponse.data.response?.success === 1) {
          steamId64 = resolveResponse.data.response.steamid;
        } else {
          return res.status(404).json({ error: "User not found" });
        }
      } catch (err) {
        return res.status(500).json({ error: 'Steam API Error' });
      }
    }

    // 2. Fetch Full Library (INCLUDES FREE GAMES NOW)
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
      return res.status(404).json({ error: 'Library is private or empty.' });
    }

    const userGames = steamResponse.data.response.games;

    // 3. Enrich with Tags
    const appIds = userGames.map(g => String(g.appid));
    const gamesFromDb = await SteamGame.find({ appid: { $in: appIds } }).lean();
    const dbMap = {};
    gamesFromDb.forEach(g => { dbMap[g.appid] = g.tags; });

    let totalPlaytime = 0;
    let playedCount = 0;
    let unplayedCount = 0;
    const tagCounts = {};

    userGames.forEach(game => {
      // Playtime Stats
      const hours = Math.round(game.playtime_forever / 60);
      totalPlaytime += hours;
      if (hours < 1) unplayedCount++;
      else playedCount++;

      // Genre Stats
      const appIdString = String(game.appid);
      let tags = POPULAR_GAMES_FIX[appIdString] || dbMap[appIdString] || [];

      // Filter out NSFW tags
      if (isExplicitContent(game.name, tags)) return;

      tags.forEach(tag => {
        const lowerTag = tag.toLowerCase();

        // Check main categories in TAG_SYNONYMS
        for (const [genre, synonyms] of Object.entries(TAG_SYNONYMS)) {
          if (genre === lowerTag || synonyms.includes(lowerTag)) {
            tagCounts[genre] = (tagCounts[genre] || 0) + 1;
          }
        }

        // Also catch major genres that might not be in synonyms list but are valid
        if (["rpg", "indie", "action", "adventure", "simulation"].includes(lowerTag)) {
          tagCounts[lowerTag] = (tagCounts[lowerTag] || 0) + 1;
        }
      });
    });

    // Format Tag Data for Chart (Top 5)
    const genreData = Object.entries(tagCounts)
      .map(([name, value]) => ({ name: name.toUpperCase(), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    res.json({
      stats: {
        totalPlaytime,
        totalGames: userGames.length,
        playedCount,
        unplayedCount,
        genreData
      }
    });

  } catch (error) {
    console.error(`[Stats Error]`, error.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// --- ROUTE 5: RECENTLY PLAYED (Sidebar) ---
router.get('/recent/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    let steamId64;

    // 1. Resolve ID
    if (/^7656\d{13}$/.test(identifier)) {
      steamId64 = identifier;
    } else {
      const resolveUrl = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v0001/`;
      const resolveResponse = await axios.get(resolveUrl, { params: { key: STEAM_API_KEY, vanityurl: identifier } });
      if (resolveResponse.data.response?.success === 1) {
        steamId64 = resolveResponse.data.response.steamid;
      } else {
        return res.status(404).json({ error: "User not found" });
      }
    }

    // 2. Fetch Recent Games (10 items)
    const recentUrl = `${STEAM_API_BASE}/IPlayerService/GetRecentlyPlayedGames/v0001/`;
    const response = await axios.get(recentUrl, {
      params: { key: STEAM_API_KEY, steamid: steamId64, count: 10 }
    });

    const games = response.data.response?.games || [];

    // 3. Format Data
    const formattedGames = games.map(g => ({
      appid: g.appid,
      name: g.name,
      playtime_2weeks: Math.round(g.playtime_2weeks / 60), // Convert to hours
      image: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${g.appid}/header.jpg`
    }));

    res.json({ games: formattedGames });

  } catch (error) {
    console.error(`[Recent Games Error]`, error.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
