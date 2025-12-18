import { useState } from 'react';
import './App.css';

function App() {
  const [steamId, setSteamId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!steamId || !prompt) {
      setError("Please fill in both fields!");
      return;
    }

    setLoading(true);
    setError(null);
    setRecommendations([]);

    // Smart ID Cleaning
    let cleanId = steamId.trim();
    if (cleanId.includes("steamcommunity.com")) {
      if (cleanId.endsWith('/')) cleanId = cleanId.slice(0, -1);
      const parts = cleanId.split('/');
      cleanId = parts[parts.length - 1];
    }

    try {
      const response = await fetch(`http://localhost:5000/api/recommendations/${cleanId}?mood=${encodeURIComponent(prompt)}`);

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server sent an error page. Check your ID.");
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Something went wrong');

      setRecommendations(data.recommendations);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>PlayMatch 🎮</h1>

      <div className="search-box">
        <input
          type="text"
          placeholder="Steam ID (e.g. 7656...)"
          value={steamId}
          onChange={(e) => setSteamId(e.target.value)}
        />
        <input
          type="text"
          placeholder="What are you in the mood for?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? 'Analyzing Library...' : 'Get Recommendations'}
        </button>
        {error && <p className="error-msg">{error}</p>}
      </div>

      <div className="results-grid">
        {recommendations.map((game, index) => (
          <div key={index} className="game-card">
            {/* NEW: Display the Game Image */}
            <div className="card-image" style={{ backgroundImage: `url(${game.image})` }}></div>
            <div className="card-content">
              <h2 className="game-title">{game.name}</h2>
              <p className="ai-reason">{game.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;