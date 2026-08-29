import React, { useState } from 'react';
import './App.css';
import GameCard from './components/GameCard';
import GamingLoader from './components/GamingLoader';
import PlaytimeMetrics from './components/PlaytimeMetrics';
import RouletteWheel from './components/RouletteWheel';
import SteamStats from './components/SteamStats';

// Explicit API URL Configuration
// Production (Vercel frontend → Render backend): uses REACT_APP_API_URL from .env.production
// Development (localhost): uses local Express server
const API_BASE = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? 'https://playmatch-backend.onrender.com' : 'http://localhost:5000');

// Defensive fetch helper: intercepts text response and logs raw content if JSON parsing fails
const defensiveFetch = async (url, options = {}) => {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    
    // Log request details for debugging
    console.log(`[API Request] ${options.method || 'GET'} ${url}`);
    console.log(`[API Response Status] ${res.status}`);
    
    try {
      const data = JSON.parse(text);
      return { ok: res.ok, status: res.status, data };
    } catch (parseError) {
      // If JSON parsing fails, log the raw HTML/text response
      console.error(`[JSON Parse Error] Failed to parse response from ${url}`);
      console.error(`[Raw Response Text] ${text.substring(0, 500)}...`); // Log first 500 chars
      throw new Error(`Server returned invalid JSON. Status: ${res.status}. Check console for raw response.`);
    }
  } catch (err) {
    console.error(`[Fetch Error] ${url}`, err);
    throw err;
  }
};

const normalizeSteamId = value => {
  const trimmedValue = value.trim();
  if (!trimmedValue.includes('/')) return trimmedValue;

  const parts = trimmedValue.split('/').filter(part => part.length > 0);
  return parts[parts.length - 1];
};

function App() {
  const [steamId, setSteamId] = useState('');
  const [mood, setMood] = useState('');
  const [showUnplayedOnly, setShowUnplayedOnly] = useState(false);
  const [sessionTime, setSessionTime] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sidebars State
  const [recentGames, setRecentGames] = useState([]);
  const [ownedGames, setOwnedGames] = useState([]);

  // Roulette States
  const [rouletteResult, setRouletteResult] = useState(null);
  const [targetGame, setTargetGame] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelGames, setWheelGames] = useState([]);
  const [spinKey, setSpinKey] = useState(0);
  const [rouletteUnplayedOnly, setRouletteUnplayedOnly] = useState(false);
  const [rouletteUnderTenHours, setRouletteUnderTenHours] = useState(false);
  const [rouletteMultiplayer, setRouletteMultiplayer] = useState(false);
  const [rouletteFilterError, setRouletteFilterError] = useState('');

  // Stats States
  const [stats, setStats] = useState(null);
  const [showStats, setShowStats] = useState(false);

  // --- NEW: Helper to load Sidebar Data ---
  const loadSidebarData = async (id) => {
    try {
      const [recentRes, libraryRes] = await Promise.all([
        defensiveFetch(`${API_BASE}/api/recent/${id}`),
        defensiveFetch(`${API_BASE}/api/user-games/${id}`)
      ]);
      
      if (recentRes.ok && recentRes.data.games) setRecentGames(recentRes.data.games);
      if (libraryRes.ok && libraryRes.data.games) setOwnedGames(libraryRes.data.games);
    } catch (err) {
      console.error("Sidebar load failed", err);
    }
  };

  const handleSearch = async () => {
    const searchMood = mood;

    // Exclusive Mode Cleanup
    setRouletteResult(null);
    setTargetGame(null);
    setWheelGames([]);
    setIsSpinning(false);

    if (!steamId || !searchMood) {
      setError('Please enter both Steam ID and what you want to play.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRecommendations([]);
    setHasSearched(true);

    try {
      const cleanId = normalizeSteamId(steamId);

      // Load sidebar data if not already loaded
      if (recentGames.length === 0) loadSidebarData(cleanId);

      const response = await defensiveFetch(
        `${API_BASE}/api/recommendations/${cleanId}?mood=${encodeURIComponent(searchMood)}&showUnplayedOnly=${showUnplayedOnly}`
      );

      if (!response.ok) throw new Error(response.data.error || 'Something went wrong');

      setRecommendations(response.data.recommendations);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSearch = async (vibe) => {
    if (!steamId) {
      setError('Please enter your Steam ID first.');
      return;
    }

    setError(null);
    setRecommendations([]);
    setHasSearched(true);
    setRouletteResult(null);
    setTargetGame(null);
    setWheelGames([]);
    setIsSpinning(false);
    setIsLoading(true);

    try {
      const cleanId = normalizeSteamId(steamId);
      const response = await defensiveFetch(
        `${API_BASE}/api/quick-picks/${cleanId}?vibe=${encodeURIComponent(vibe)}&showUnplayedOnly=${showUnplayedOnly}`
      );
      
      if (!response.ok) throw new Error(response.data.error || 'Unable to filter your Steam library.');

      setRecommendations(response.data.recommendations);

      if (response.data.recommendations.length === 0 && !showUnplayedOnly) {
        setError(`No ${vibe} games were found in your tagged Steam library.`);
      }

      if (recentGames.length === 0) loadSidebarData(cleanId);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoulette = async () => {
    if (!steamId) {
      setError('Please enter your Steam ID first.');
      return;
    }

    setRecommendations([]);
    setRouletteResult(null);
    setTargetGame(null);
    setWheelGames([]);
    setError(null);
    setRouletteFilterError('');

    try {
      const cleanId = normalizeSteamId(steamId);
      let library = ownedGames;

      if (library.length === 0) {
        const response = await defensiveFetch(`${API_BASE}/api/user-games/${cleanId}`);
        if (!response.ok) throw new Error(response.data.error || 'Unable to load your Steam library.');
        library = response.data.games;
        setOwnedGames(library);
      }

      const candidates = library.filter(game => {
        const playtime = Number(game.playtime_forever || 0);
        const tags = Array.isArray(game.tags) ? game.tags.map(tag => tag.toLowerCase()) : [];
        const matchesUnplayed = !rouletteUnplayedOnly || playtime === 0;
        const matchesShortSession = !rouletteUnderTenHours || (playtime > 0 && playtime < 600);
        const matchesMultiplayer = !rouletteMultiplayer || tags.some(tag => tag.includes('multiplayer') || tag.includes('co-op') || tag.includes('coop'));
        return matchesUnplayed && matchesShortSession && matchesMultiplayer;
      });

      if (candidates.length === 0) {
        setRouletteFilterError('No games match these filters!');
        return;
      }

      setIsSpinning(true);
      setSpinKey(prev => prev + 1);
      const shuffledCandidates = [...candidates].sort(() => 0.5 - Math.random());
      const winner = shuffledCandidates[0];

      setWheelGames([winner, ...shuffledCandidates.slice(1, 10)]);
      setTargetGame(winner);

      setTimeout(() => {
        setRouletteResult(winner);
        setIsSpinning(false);
      }, 4000);

    } catch (err) {
      setError(err.message);
      setIsSpinning(false);
    }
  };

  const rouletteCandidates = ownedGames.filter(game => {
    const playtime = Number(game.playtime_forever || 0);
    const tags = Array.isArray(game.tags) ? game.tags.map(tag => tag.toLowerCase()) : [];
    return (!rouletteUnplayedOnly || playtime === 0)
      && (!rouletteUnderTenHours || (playtime > 0 && playtime < 600))
      && (!rouletteMultiplayer || tags.some(tag => tag.includes('multiplayer') || tag.includes('co-op') || tag.includes('coop')));
  });

  const handleStats = async () => {
    if (!steamId) {
      setError('Please enter your Steam ID first to see stats.');
      return;
    }
    setRouletteResult(null);
    setIsSpinning(false);
    setIsLoading(true);
    setError(null);

    try {
      const cleanId = normalizeSteamId(steamId);

      const res = await defensiveFetch(`${API_BASE}/api/stats/${cleanId}`);

      if (!res.ok) throw new Error(res.data.error);

      setStats(res.data.stats);
      setShowStats(true);

      // Load sidebar data if not already loaded
      if (recentGames.length === 0) loadSidebarData(cleanId);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">

      {/* --- NEW 3-COLUMN LAYOUT --- */}
      <div className="dashboard-layout">

        {/* LEFT SIDEBAR: RECENT GAMES */}
        <aside className="sidebar left-sidebar">
          <h3>Jump Back In</h3>
          {recentGames.length > 0 ? (
            <div className="recent-list">
              {recentGames.map(game => (
                <div key={game.appid} className="recent-card">
                  <img src={game.image} alt={game.name} />
                  <div className="recent-info">
                    <span>{game.name}</span>
                    <small>{game.playtime_2weeks} hrs past 2 weeks</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="sidebar-placeholder">Enter Steam ID to see history</p>
          )}
        </aside>

        {/* CENTER: MAIN CONTENT */}
        <main className="main-content">
          <h1 className="title">PlayMatch</h1>
          <p className="subtitle">AI-Powered Steam Library Recommendations</p>

          <div className="search-card">
            <input
              type="text"
              className="input-field"
              placeholder="Steam ID or Profile URL"
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              disabled={isLoading}
            />
            <div className="mood-search-group">
              <input
                type="text"
                className="input-field"
                placeholder="What's your vibe? (e.g. Shooter, Chill)"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                disabled={isLoading}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <div className="toggle-wrapper">
                <label className="toggle-control">
                  <input
                    type="checkbox"
                    checked={showUnplayedOnly}
                    onChange={(e) => setShowUnplayedOnly(e.target.checked)}
                    disabled={isLoading}
                  />
                  <span className="unplayed-toggle__track" aria-hidden="true">
                    <span className="unplayed-toggle__thumb" />
                  </span>
                  <span className="unplayed-toggle__label">Show Unplayed Only</span>
                </label>
              </div>
            </div>

            <div className="roulette-filter-row" aria-label="Roulette filters">
              <span className="roulette-filter-label">Roulette filters</span>
              <label className="filter-pill">
                <input type="checkbox" checked={rouletteUnplayedOnly} onChange={(e) => setRouletteUnplayedOnly(e.target.checked)} disabled={isLoading || isSpinning} />
                <span>Unplayed Only</span>
              </label>
              <label className="filter-pill">
                <input type="checkbox" checked={rouletteUnderTenHours} onChange={(e) => setRouletteUnderTenHours(e.target.checked)} disabled={isLoading || isSpinning} />
                <span>Under 10 Hours</span>
              </label>
              <label className="filter-pill">
                <input type="checkbox" checked={rouletteMultiplayer} onChange={(e) => setRouletteMultiplayer(e.target.checked)} disabled={isLoading || isSpinning} />
                <span>Multiplayer</span>
              </label>
            </div>

            <div className="button-group">
              <button className="btn primary-btn" onClick={handleSearch} disabled={isLoading || isSpinning}>
                {isLoading ? 'Analyzing...' : 'Find Games'}
              </button>
              <button className="btn roulette-btn" onClick={handleRoulette} disabled={isLoading || isSpinning || (ownedGames.length > 0 && rouletteCandidates.length === 0)}>
                {isSpinning ? '🎲 Surprise Me' : '🎲 Surprise Me'}
              </button>
              <button className="btn stats-btn" onClick={handleStats} disabled={isLoading || isSpinning}>
                🎮 Profile DNA
              </button>
            </div>

            {rouletteFilterError && <div className="roulette-filter-error" role="status">{rouletteFilterError}</div>}

            {error && <div className="error-msg">{error}</div>}
          </div>

          {/* DYNAMIC CONTENT AREA */}
          {isSpinning && (
            <div className="wheel-overlay">
              <RouletteWheel
                isSpinning={isSpinning}
                games={wheelGames}
                targetGame={targetGame}
                spinKey={spinKey}
              />
            </div>
          )}

          {rouletteResult && (
            <div className="winner-overlay">
              <div className="winner-card">
                <h2>✨ The Fates Have Chosen ✨</h2>
                <img src={rouletteResult.image} alt={rouletteResult.name} />
                <h3>{rouletteResult.name}</h3>
                <p>{rouletteResult.reason}</p>
                <PlaytimeMetrics game={rouletteResult} />
                <div className="winner-actions">
                  <button className="btn close-btn" onClick={() => setRouletteResult(null)}>Close</button>
                  <button className="btn roulette-btn" onClick={handleRoulette}>Spin Again</button>
                </div>
              </div>
            </div>
          )}

          {showStats && <SteamStats stats={stats} onClose={() => setShowStats(false)} />}

          <div className={`results-grid ${isLoading ? 'results-grid--loading' : ''}`}>
            {isLoading && <GamingLoader />}
            {!isLoading && hasSearched && showUnplayedOnly && !error && recommendations.length === 0 && (
              <div className="empty-results" role="status">
                You've conquered this backlog! No unplayed games found here. Try turning off the Unplayed filter to see your favorites.
              </div>
            )}
            {!isLoading && recommendations.map(game => <GameCard key={game.appid} game={game} />)}
          </div>

          {ownedGames.length > 0 && (
            <section className="hall-of-fame" aria-labelledby="hall-of-fame-title">
              <div className="section-heading">
                <h2 id="hall-of-fame-title">Your Hall of Fame</h2>
                <span>Most played from your library</span>
              </div>
              <div className="hall-of-fame-grid">
                {[...ownedGames]
                  .sort((firstGame, secondGame) => secondGame.playtime_forever - firstGame.playtime_forever)
                  .slice(0, 10)
                  .map(game => <GameCard key={game.appid} game={game} />)}
              </div>
            </section>
          )}
        </main>

        {/* RIGHT SIDEBAR: QUICK PICKS */}
        <aside className="sidebar right-sidebar">
          <div className="session-picker">
            <h3>Session Time</h3>
            <div className="session-options">
              {['15 Min Quick Hit', '1 Hour Session', 'All-Night Binge'].map(session => (
                <button
                  key={session}
                  className={`session-option ${sessionTime === session ? 'session-option--active' : ''}`}
                  onClick={() => { setSessionTime(session); handleQuickSearch(session); }}
                  disabled={isLoading || isSpinning}
                >
                  {session}
                </button>
              ))}
            </div>
          </div>
          <h3>Quick Picks</h3>
          <div className="vibes-grid">
            {['Action', 'RPG', 'Strategy', 'Co-Op', 'Sci-Fi', 'Horror', 'Cozy', 'Simulation', 'FPS', 'Open World', 'Survival', 'Indie', 'Roguelike', 'Platformer', 'Puzzle', 'Story Rich', 'Casual', 'Cyberpunk', 'Card & Board', 'Sports & Racing'].map(vibe => (
              <button key={vibe} className="vibe-chip" onClick={() => handleQuickSearch(vibe)} disabled={isLoading || isSpinning}>
                {vibe}
              </button>
            ))}
          </div>
        </aside>

      </div>
    </div>
  );
}

export default App;
