import React, { useState } from 'react';
import './App.css';
import GameCard from './components/GameCard';
import GamingLoader from './components/GamingLoader';
import PlaytimeMetrics from './components/PlaytimeMetrics';
import RouletteWheel from './components/RouletteWheel';
import SteamStats from './components/SteamStats';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const normalizeSteamId = value => {
  const trimmedValue = value.trim();
  if (!trimmedValue.includes('/')) return trimmedValue;

  const parts = trimmedValue.split('/').filter(part => part.length > 0);
  return parts[parts.length - 1];
};

function App() {
  const [steamId, setSteamId] = useState('');
  const [mood, setMood] = useState('');
  const [recommendations, setRecommendations] = useState([]);
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

  // Stats States
  const [stats, setStats] = useState(null);
  const [showStats, setShowStats] = useState(false);

  // --- NEW: Helper to load Sidebar Data ---
  const loadSidebarData = async (id) => {
    try {
      const [recentResponse, libraryResponse] = await Promise.all([
        fetch(`${API_BASE}/api/recent/${id}`),
        fetch(`${API_BASE}/api/user-games/${id}`)
      ]);
      const recentData = await recentResponse.json();
      const libraryData = await libraryResponse.json();

      if (recentResponse.ok) setRecentGames(recentData.games);
      if (libraryResponse.ok) setOwnedGames(libraryData.games);
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

    try {
      const cleanId = normalizeSteamId(steamId);

      // Load sidebar data if not already loaded
      if (recentGames.length === 0) loadSidebarData(cleanId);

      const response = await fetch(
        `${API_BASE}/api/recommendations/${cleanId}?mood=${encodeURIComponent(searchMood)}`
      );

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Something went wrong');

      setRecommendations(data.recommendations);
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
    setRouletteResult(null);
    setTargetGame(null);
    setWheelGames([]);
    setIsSpinning(false);
    setIsLoading(true);

    try {
      const cleanId = normalizeSteamId(steamId);
      const response = await fetch(
        `${API_BASE}/api/quick-picks/${cleanId}?vibe=${encodeURIComponent(vibe)}`
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Unable to filter your Steam library.');

      setRecommendations(data.recommendations);

      if (data.recommendations.length === 0) {
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
    setIsSpinning(true);
    setSpinKey(prev => prev + 1);

    try {
      const cleanId = normalizeSteamId(steamId);

      // Load sidebar data if not already loaded
      if (recentGames.length === 0) loadSidebarData(cleanId);

      const response = await fetch(`${API_BASE}/api/roulette/${cleanId}`);
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
    setIsLoading(true);
    setError(null);

    try {
      const cleanId = normalizeSteamId(steamId);

      const res = await fetch(`${API_BASE}/api/stats/${cleanId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setStats(data.stats);
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
            <input
              type="text"
              className="input-field"
              placeholder="What's your vibe? (e.g. Shooter, Chill)"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              disabled={isLoading}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />

            <div className="button-group">
              <button className="btn primary-btn" onClick={handleSearch} disabled={isLoading || isSpinning}>
                {isLoading ? 'Analyzing...' : 'Find Games'}
              </button>
              <button className="btn roulette-btn" onClick={handleRoulette} disabled={isLoading || isSpinning}>
                {isSpinning ? '🎲 Surprise Me' : '🎲 Surprise Me'}
              </button>
              <button className="btn stats-btn" onClick={handleStats} disabled={isLoading || isSpinning}>
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
          <h3>Quick Picks</h3>
          <div className="vibes-grid">
            {['Action', 'RPG', 'Strategy', 'Co-Op', 'Sci-Fi', 'Horror', 'Cozy', 'Simulation'].map(vibe => (
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
