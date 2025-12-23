// Server/seed_db.js
const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
require('dotenv').config();

// 1. Define the Schema for a "SteamGame"
const GameSchema = new mongoose.Schema({
    appid: { type: String, required: true, unique: true, index: true }, // Index for fast search
    name: String,
    tags: [String]
});

const SteamGame = mongoose.model('SteamGame', GameSchema);

// 2. Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("✅ Connected to MongoDB. Starting migration...");
        seedData();
    })
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// 3. The Migration Function
async function seedData() {
    const results = [];
    const BATCH_SIZE = 1000; // Insert 1000 games at a time to save memory
    let count = 0;

    const stream = fs.createReadStream(path.join(__dirname, 'steam_metadata.csv'))
        .pipe(csv());

    for await (const row of stream) {
        const appId = row.AppID || row.appid;
        const name = row.Name || row.name;

        // Magnet Logic (Same as your API)
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

        if (appId && name) {
            results.push({
                updateOne: {
                    filter: { appid: String(appId) },
                    update: {
                        $set: {
                            name: name,
                            tags: [...new Set(tags)]
                        }
                    },
                    upsert: true // If it doesn't exist, create it. If it does, update it.
                }
            });
        }

        // Execute Batch
        if (results.length >= BATCH_SIZE) {
            await SteamGame.bulkWrite(results);
            count += results.length;
            process.stdout.write(`\rProcessed ${count} games...`);
            results.length = 0; // Clear array
        }
    }

    // Insert remaining
    if (results.length > 0) {
        await SteamGame.bulkWrite(results);
        count += results.length;
    }

    console.log(`\n\n✅ DONE! Migrated ${count} games to MongoDB.`);
    process.exit();
}