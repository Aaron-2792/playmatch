# PlayMatch

PlayMatch turns an overwhelming Steam backlog into a clear next choice. It exists for the moment when a gamer has hundreds of games, too many options, and the familiar guilt of leaving a library untouched: connect a Steam profile, describe the experience you want, and get recommendations grounded in the games you already own.

**[View the live application](https://playmatch-gamma.vercel.app/)**

## Product Overview

PlayMatch combines live Steam library data, structured game metadata, and Gemini-powered natural-language recommendations in a focused dashboard. The experience supports both deliberate discovery, such as searching for a “cozy base builder,” and low-effort discovery, such as filtering by a session length or spinning the roulette wheel.

## Features

- **Steam Web API integration:** Fetches owned games, recent activity, profile statistics, artwork, tags, and `playtime_forever` metrics. The backend normalizes and enriches large library arrays before they reach the recommendation engine or dashboard.
- **Gemini AI recommendation engine:** Uses carefully structured prompts, constrained library samples, exact Steam app IDs, and validation against the user’s actual collection to produce personalized recommendations without inventing games.
- **Resurrect Unplayed filter:** A React state toggle filters games where `playtime_forever` is zero or missing before recommendation requests and Quick Pick matching, helping users recover games buried in their backlog.
- **Session Time recommender:** Presets for `15 Min Quick Hit`, `1 Hour Session`, and `All-Night Binge` apply semantic tag groups before results are generated. The interface presents only relevant game cards, keeping the underlying heuristic logic out of the UI.
- **Fuzzy-matching Quick Picks:** Broad genre and mood categories map to normalized backend tag groups and fuzzy matching, making filters resilient to inconsistent Steam metadata and easy to scan.
- **Surprise Me roulette:** A customizable wheel selects from the user’s library with optional Unplayed, Under 10 Hours, and Multiplayer filters. Candidate filtering happens before random selection, with graceful empty states when no games qualify.
- **Profile DNA and activity:** Recharts visualizations summarize play history and library patterns, while “Jump Back In” surfaces recent Steam activity and a Hall of Fame highlights the most-played games.
- **Responsive dashboard UI:** CSS Grid and Flexbox organize the three-column desktop layout, adaptive result cards, scrollable library highlights, and compact controls across screen sizes.

## Architecture

The application uses a split deployment architecture:

- **Frontend:** React single-page application deployed on Vercel.
- **Backend:** Node.js and Express API deployed on Render.
- **Data flow:** The backend retrieves Steam data, resolves metadata and tags, applies safety and filtering rules, and calls Gemini only with constrained library data. The frontend owns interactive state and presents the resulting recommendations.
- **Persistence:** MongoDB, accessed through Mongoose, stores normalized game metadata used for tag matching and enrichment.

## Tech Stack

- **Frontend:** React, React DOM, Recharts
- **Backend:** Node.js, Express
- **Database:** MongoDB, Mongoose
- **Layout and styling:** CSS Grid, Flexbox, responsive CSS, animated custom controls
- **AI:** Google Gemini Generative AI SDK
- **External services:** Steam Web API and Steam Store API
- **Operational safeguards:** Helmet, CORS, rate limiting, retry handling, and recommendation validation

## Local Installation

### Prerequisites

- Node.js 18 or newer
- A Steam Web API key
- A Google Gemini API key
- A MongoDB connection string

### 1. Clone the repository

```bash
git clone https://github.com/Aaron-2792/playmatch.git
cd playmatch
```

### 2. Configure and start the backend

```bash
cd Server
npm install
npm start
```

Create `Server/.env` before starting the API:

```env
STEAM_API_KEY=your_steam_api_key
GEMINI_API_KEY=your_gemini_api_key
MONGO_URI=your_mongodb_connection_string
PORT=5000
```

### 3. Configure and start the frontend

Open a second terminal:

```bash
cd client
npm install
npm start
```

Create `client/.env` to point the React app at the local API:

```env
REACT_APP_API_URL=http://localhost:5000
```

The frontend runs at `http://localhost:3000` by default.

## Production Build

Create an optimized frontend bundle with:

```bash
cd client
npm run build
```

For deployment, configure the Vercel frontend environment with the Render API URL as `REACT_APP_API_URL`, and configure the Render backend with the server environment variables above.
