import React, { useState } from 'react';
import './App.css';
import RouletteWheel from './components/RouletteWheel';
import SteamStats from './components/SteamStats';

function App() {
  const [steamId, setSteamId] = useState('');
  const [mood, setMood] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sidebars State
  const [recentGames, setRecentGames] = useState([]);

  // Roulette States
  const [rouletteResult, setRouletteResult] = useState(null);
  const [targetGame, setTargetGame] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelGames, setWheelGames] = useState([]);
  const [spinKey, setSpinKey] = useState(0);

  // Stats States
  const [stats, setStats] = useState(null);
  const [showStats, setShowStats] = useState(false);

  // --- NEW: Helper to load Sidebar Data ---
  const loadSidebarData = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/recent/${id}`);
      const data = await res.json();
      if (res.ok) setRecentGames(data.games);
    } catch (err) {
      console.error("Sidebar load failed", err);
    }
  };

  const handleSearch = async (overrideMood = null) => {
    const searchMood = overrideMood || mood; // Allow clicking chips to search

    // Exclusive Mode Cleanup
    setRouletteResult(null);
    setTargetGame(null);
    setWheelGames([]);
    setIsSpinning(false);

    if (!steamId || !searchMood) {
      setError('Please enter both Steam ID and what you want to play.');
      return;
    }

    setLoading(true);
    setError(null);
    setRecommendations([]);

    try {
      let cleanId = steamId.trim();
      if (cleanId.includes('/')) {
        const parts = cleanId.split('/').filter(p => p.length > 0);
        cleanId = parts[parts.length - 1];
      }

      // Load sidebar data if not already loaded
      if (recentGames.length === 0) loadSidebarData(cleanId);

      const response = await fetch(
        `http://localhost:5000/api/recommendations/${cleanId}?mood=${encodeURIComponent(searchMood)}`
      );

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Something went wrong');

      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSearch = (vibe) => {
    setMood(vibe);
    handleSearch(vibe);
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
    setIsSpinning(true);
    setSpinKey(prev => prev + 1);

    try {
      let cleanId = steamId.trim();
      if (cleanId.includes('/')) {
        const parts = cleanId.split('/').filter(p => p.length > 0);
        cleanId = parts[parts.length - 1];
      }

      // Load sidebar data if not already loaded
      if (recentGames.length === 0) loadSidebarData(cleanId);

      const response = await fetch(`http://localhost:5000/api/roulette/${cleanId}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Roulette failed');

      const winner = data.recommendation;
      const fillers = data.recommendation.fillers || [];

      setWheelGames([winner, ...fillers]);
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

  const handleStats = async () => {
    if (!steamId) {
      setError('Please enter your Steam ID first to see stats.');
      return;
    }
    setRouletteResult(null);
    setIsSpinning(false);
    setLoading(true);
    setError(null);

    try {
      let cleanId = steamId.trim();
      if (cleanId.includes('/')) {
        const parts = cleanId.split('/').filter(p => p.length > 0);
        cleanId = parts[parts.length - 1];
      }

      const res = await fetch(`http://localhost:5000/api/stats/${cleanId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setStats(data.stats);
      setShowStats(true);

      // Load sidebar data if not already loaded
      if (recentGames.length === 0) loadSidebarData(cleanId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
            />
            <input
              type="text"
              className="input-field"
              placeholder="What's your vibe? (e.g. Shooter, Chill)"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />

            <div className="button-group">
              <button className="btn primary-btn" onClick={() => handleSearch()} disabled={loading || isSpinning}>
                {loading ? 'Analyzing...' : 'Find Games'}
              </button>
              <button className="btn roulette-btn" onClick={handleRoulette} disabled={loading || isSpinning}>
                {isSpinning ? '🎲 Surprise Me' : '🎲 Surprise Me'}
              </button>
              <button className="btn stats-btn" onClick={handleStats} disabled={loading || isSpinning}>
                🎮 Profile DNA
              </button>
            </div>

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
                <div className="winner-actions">
                  <button className="btn close-btn" onClick={() => setRouletteResult(null)}>Close</button>
                  <button className="btn roulette-btn" onClick={handleRoulette}>Spin Again</button>
                </div>
              </div>
            </div>
          )}

          {showStats && <SteamStats stats={stats} onClose={() => setShowStats(false)} />}

          <div className="results-grid">
            {recommendations.map((game) => (
              <div key={game.appid} className="game-card">
                <div
                  className="card-image"
                  style={{ backgroundImage: `url(${game.image})` }}
                ></div>
                <div className="card-content">
                  <div className="game-title">{game.name}</div>
                  <div className="game-reason">{game.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* RIGHT SIDEBAR: QUICK PICKS */}
        <aside className="sidebar right-sidebar">
          <h3>Quick Picks</h3>
          <div className="vibes-grid">
            {[
              // Genres
              'RPG', 'FPS', 'RTS', 'MOBA', 'MMO', 'Roguelike', 'Metroidvania',
              'Platformer', 'Fighting', 'Racing', 'Sports', 'Puzzle', 'Strategy',
              'Simulation', 'Survival', 'Horror', 'Battle Royale', 'Visual Novel',

              // Vibes & Moods
              'Cozy', 'Relaxing', 'Chaos', 'Rage-Quit', 'Hardcore', 'Casual',
              'Competitive', 'Funny', 'Dark', 'Wholesome', 'Atmospheric',
              'Story Rich', 'Fast-Paced', 'Slow Burn', 'Nostalgia',

              // Themes
              'Cyberpunk', 'Steampunk', 'Sci-Fi', 'Space', 'Fantasy', 'Medieval',
              'Zombies', 'Vampires', 'Post-Apocalyptic', 'Military', 'Aliens',
              'Noir', 'Mystery',

              // Mechanics & Tech
              'Open World', 'Sandbox', 'Crafting', 'Turn-Based', 'Hack & Slash',
              'Looter Shooter', 'Stealth', 'Co-op', 'PvP', 'VR', 'Pixel Art'
            ].map(vibe => (
              <button key={vibe} className="vibe-chip" onClick={() => handleQuickSearch(vibe)}>
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