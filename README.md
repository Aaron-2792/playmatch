# 🎮 PlayMatch

> An AI-powered full-stack web application designed to cure "choice paralysis" by analyzing your Steam library and generating highly personalized game recommendations.

**[View Live Demo](https://playmatch-gamma.vercel.app/)** ## 🚀 Overview
PlayMatch transforms raw Steam data into actionable insights. By integrating the Steam Web API with Google's Gemini 2.0 LLM, the application not only visualizes a user's gaming habits but also allows them to search their backlog using natural language prompts (e.g., "Cozy base builder," "Fast-paced cyberpunk"). 

## 🛠️ Tech Stack
* **Frontend:** React.js, CSS Grid, Recharts (Data Visualization)
* **Backend:** Node.js, Express.js
* **Database:** MongoDB / Mongoose (NoSQL)
* **AI / External APIs:** Google Gemini 2.0 LLM, Steam Web API

## ✨ Key Features
* **Profile DNA Dashboard:** Visualizes library completion rates (Played vs. Unplayed) and top genre distributions using Recharts.
* **AI Smart Search:** Maps 50+ user-friendly tags to backend metadata and uses generative AI to analyze and recommend games based on specific moods.
* **Jump Back In:** Fetches real-time, 2-week "Recently Played" history directly from Steam.
* **Saved for Later (Wishlist):** Full CRUD functionality powered by MongoDB, allowing users to persist their favorite recommendations.
* **Exclusive UI States:** Custom React Hooks and logic ensure features like the Roulette Wheel randomizer and search results render seamlessly without cluttering the responsive 3-column CSS Grid.

## 💻 Local Installation & Setup

### 1. Clone the repository
\`\`\`bash
git clone https://github.com/Aaron-2792/playmatch.git
cd playmatch
\`\`\`

### 2. Backend Setup
Navigate to the server directory and install dependencies:
\`\`\`bash
cd server
npm install
\`\`\`
Create a `.env` file in the `server` directory and add your API keys:
\`\`\`text
STEAM_API_KEY=your_steam_api_key
GEMINI_API_KEY=your_gemini_api_key
MONGO_URI=your_mongodb_connection_string
PORT=5000
\`\`\`
Start the backend server:
\`\`\`bash
npm start
\`\`\`

### 3. Frontend Setup
Open a new terminal, navigate to the client directory, and install dependencies:
\`\`\`bash
cd client
npm install
\`\`\`
Create a `.env` file in the `client` directory:
\`\`\`text
REACT_APP_API_URL=http://localhost:5000
\`\`\`
Start the React application:
\`\`\`bash
npm start
\`\`\`

## 🔮 Future Roadmap
* Implement a "Co-op Matcher" to find intersecting multiplayer games between two Steam IDs.
* Add embedded YouTube/Steam trailers to game detail modals.
