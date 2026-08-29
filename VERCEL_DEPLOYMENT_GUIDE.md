# Vercel Deployment Configuration Guide

## Overview
Your React/Express/MongoDB app has been configured for Vercel serverless deployment. This guide explains all the changes made to resolve the "JSON.parse: unexpected character" error.

---

## 1. ✅ Configuration Files Created

### `vercel.json` (Root Directory)
```json
{
  "buildCommand": "cd client && npm run build",
  "outputDirectory": "client/build",
  "functions": {
    "Server/index.js": {
      "memory": 1024,
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/Server/index.js"
    },
    {
      "source": "/(.*)",
      "destination": "/"
    }
  ]
}
```

**What it does:**
- **buildCommand**: Builds your React app from the `client` folder
- **outputDirectory**: Serves the compiled React build as static files
- **rewrites**: Routes all `/api/*` requests to your Express backend (`Server/index.js`)
- **catch-all rewrite**: Routes all other requests to `/` (React SPA fallback)
- **functions config**: Sets memory and timeout for your API endpoint

### `client/.env.production`
```
REACT_APP_API_URL=/api
```
Used during production build to point to the relative `/api` path.

### `client/.env.local`
```
REACT_APP_API_URL=http://localhost:5000/api
```
Used during local development when running `npm start`.

---

## 2. ✅ Code Changes Made

### `Server/index.js` (Modified)
**Before:**
```javascript
app.listen(PORT, () => {
  console.log(`[PlayMatch] 🚀 Server running on port ${PORT}`);
});
```

**After:**
```javascript
// 4. Start Server (for local development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`[PlayMatch] 🚀 Server running on port ${PORT}`);
  });
}

// 5. Export for Vercel serverless
module.exports = app;
```

**Why:** Vercel's serverless runtime cannot use `app.listen()`. The app must be exported as a module.

### `client/src/App.js` (Modified)
**Before:**
```javascript
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
// Then: fetch(`${API_BASE}/api/recent/${id}`)
```

**After:**
```javascript
const API_BASE = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api');
// Then: fetch(`${API_BASE}/recent/${id}`)
```

**Why:** 
- Removes hardcoded `localhost` in production
- Uses relative `/api` path in production (handled by vercel.json rewrites)
- Prevents double `/api` path in fetch calls

**All fetch calls updated** (removed `/api` duplication):
- `fetch(\`${API_BASE}/recent/${id}\`)` 
- `fetch(\`${API_BASE}/user-games/${id}\`)`
- `fetch(\`${API_BASE}/recommendations/${cleanId}...\`)`
- etc.

---

## 3. How It Works

### Local Development
1. Start your Express server: `cd Server && npm start` (runs on `http://localhost:5000`)
2. Start your React app: `cd client && npm start` (runs on `http://localhost:3000`)
3. React fetches use `REACT_APP_API_URL=http://localhost:5000/api` from `.env.local`
4. All API calls go directly to Express backend ✅

### Production on Vercel
1. Your React app builds to `client/build` and is served as static files
2. Any request to `/api/*` is **rewritten** to `/Server/index.js` (Express backend)
3. Express receives the request and processes it
4. React fetches use relative `/api` path (set in `.env.production`)
5. The `vercel.json` rewrites ensure routes don't conflict ✅

### Route Flow (Production)
```
Browser Request: GET /api/stats/12345
                    ↓
Vercel Routes → /api/(.*)
                    ↓
Rewrite to → /Server/index.js
                    ↓
Express App (app.js)
                    ↓
Route Handler: GET /api/stats/12345
                    ↓
Returns JSON Response ✅
```

---

## 4. Deployment Checklist

- [ ] Commit all changes to git
- [ ] Push to GitHub (or your Vercel-connected repo)
- [ ] Connect your repository to Vercel
- [ ] Set environment variables in Vercel dashboard:
  - `MONGO_URI`: Your MongoDB connection string
  - `NODE_ENV`: Set to `production`
  - Any other API keys (Google Generative AI, etc.)
- [ ] Deploy!

---

## 5. Important Notes

### Environment Variables
- **Local Dev**: Uses `.env.local` (ignored by git, create if needed)
- **Production**: Set via Vercel dashboard Settings → Environment Variables
- **Build Time**: React uses `.env.production` during build

### CORS Configuration
Your Express app already has CORS enabled:
```javascript
app.use(cors());
```
This is good because the React build will be served from the same domain, so CORS won't block requests.

### MongoDB Connection
Ensure `MONGO_URI` is set in Vercel's environment variables:
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
```

### Troubleshooting
If you still get JSON parse errors:
1. Check browser DevTools → Network tab to see actual API responses
2. Verify `vercel.json` rewrites are correct
3. Check Vercel Function logs for Express errors
4. Ensure MongoDB is accessible from Vercel's servers

---

## 6. Folder Structure Summary
```
playmatch/
├── vercel.json                    # ✅ NEW - Vercel configuration
├── Server/
│   ├── index.js                   # ✅ MODIFIED - exports app + optional listen
│   ├── app.js                     # Express app (no changes needed)
│   ├── routes/api.js              # Your API routes (no changes needed)
│   └── package.json
└── client/
    ├── .env.local                 # ✅ NEW - Local dev env vars
    ├── .env.production            # ✅ NEW - Production env vars
    ├── src/
    │   └── App.js                 # ✅ MODIFIED - Fixed API_BASE & fetch calls
    └── package.json
```

---

## Next Steps
1. Test locally: `cd client && npm start` (should work as before)
2. Commit changes
3. Push to GitHub
4. Deploy to Vercel via dashboard or CLI
5. Monitor Vercel Function logs for any issues
