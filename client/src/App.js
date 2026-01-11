// client/src/App.js
import React, { useState } from 'react';
import './App.css';

function App() {
  const [steamId, setSteamId] = useState('');
  const [mood, setMood] = useState('');
  const [includeAdult, setIncludeAdult] = useState(false); // New Checkbox State
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!steamId || !mood) {
      setError('Please enter both Steam ID and what you want to play.');
      return;
    }

    setLoading(true);
    setError(null);
    setRecommendations([]);

    try {
      // --- SMART FIX: Extract ID if user pastes a full URL ---
      let cleanId = steamId.trim();

      // If the input contains slashes (like https://steamcommunity...), clean it
      if (cleanId.includes('/')) {
        // Split by slash and remove empty chunks
        const parts = cleanId.split('/').filter(p => p.length > 0);
        // Grab the very last part (which is usually the ID or Name)
        cleanId = parts[parts.length - 1];
      }
      // -------------------------------------------------------

      // Pass the cleanId and includeAdult parameter to the server
      const response = await fetch(
        `http://localhost:5000/api/recommendations/${cleanId}?mood=${encodeURIComponent(mood)}&includeAdult=${includeAdult}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>PlayMatch</h1>

      <div className="search-box">
        <input
          type="text"
          placeholder="Enter Steam ID / Vanity URL"
          value={steamId}
          onChange={(e) => setSteamId(e.target.value)}
        />
        <input
          type="text"
          placeholder="What do you want to play? (e.g., Shooter, Story, Chill)"
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />

        {/* --- NEW CHECKBOX AREA --- */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b3b3b3', justifyContent: 'center' }}>
          <input
            type="checkbox"
            id="adultCheck"
            checked={includeAdult}
            onChange={(e) => setIncludeAdult(e.target.checked)}
            style={{ width: 'auto', margin: 0 }}
          />
          <label htmlFor="adultCheck" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>
            Show Adult/NSFW Games
          </label>
        </div>
        {/* ------------------------- */}

        <button onClick={handleSearch} disabled={loading}>
          {loading ? 'Finding Games...' : 'Find My Game'}
        </button>

        {error && <div className="error-msg">{error}</div>}
      </div>

      {loading && <div className="loading">Analyzing Library...</div>}

      <div className="results-grid">
        {recommendations.map((game) => (
          <div key={game.appid} className="game-card">
            <div
              className="card-image"
              style={{ backgroundImage: `url(${game.image})` }}
            ></div>
            <div className="card-content">
              <div>
                <div className="game-title">{game.name}</div>
                <div className="ai-reason">{game.reason}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;