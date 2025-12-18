// server/check-models.js
require('dotenv').config();

async function checkModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.log("❌ No GEMINI_API_KEY found in .env");
        return;
    }

    console.log("🔍 Asking Google for available models...");

    try {
        // We use a direct fetch to ask the API what is available
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.error) {
            console.log("❌ Error from Google:", data.error.message);
            return;
        }

        console.log("\n✅ AVAILABLE MODELS FOR YOUR KEY:");
        console.log("---------------------------------------------");

        // Filter for models that can write text (generateContent)
        const available = data.models.filter(m =>
            m.supportedGenerationMethods.includes("generateContent")
        );

        available.forEach(m => {
            // We print the clean name you need to copy
            console.log(`"${m.name.replace('models/', '')}"`);
        });
        console.log("---------------------------------------------");
        console.log("👉 Copy one of the names above (like 'gemini-1.5-flash') into your api.js file.");

    } catch (error) {
        console.error("Failed to run check:", error);
    }
}

checkModels();