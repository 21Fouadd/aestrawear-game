require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy to ensure req.ip is correct behind cloud hosts (Render, Railway, etc.)
app.set('trust proxy', true);

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// In-memory token store for anti-cheat validations
const activeSessions = new Map();

// ══════════════════════════════════════════
//  MONGODB CONNECTION
// ══════════════════════════════════════════
let db;

async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI is not set in .env — leaderboard will NOT persist!');
        process.exit(1);
    }
    const client = new MongoClient(uri);
    await client.connect();
    db = client.db('aestrawear');
    console.log('✅ Connected to MongoDB Atlas');
}

// ══════════════════════════════════════════
//  ANTI-CHEAT IP RATE LIMITING
// ══════════════════════════════════════════
const MAX_ATTEMPTS = 999999; // Effectively unlimited

app.get('/api/attempts/check', async (req, res) => {
    try {
        const ip = req.ip;
        const record = await db.collection('attempts').findOne({ ip });
        const used = record ? record.count : 0;
        const remaining = Math.max(0, MAX_ATTEMPTS - used);
        res.json({ remaining, used, ip });
    } catch (e) {
        console.error('Error checking attempts:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/attempts/start', async (req, res) => {
    try {
        const ip = req.ip;
        const record = await db.collection('attempts').findOne({ ip });
        const used = record ? record.count : 0;

        if (used >= MAX_ATTEMPTS) {
            return res.status(403).json({ error: 'All attempts used for this IP address.', remaining: 0 });
        }

        // Increment and save (upsert = create if doesn't exist)
        await db.collection('attempts').updateOne(
            { ip },
            { $set: { ip, count: used + 1 } },
            { upsert: true }
        );

        // Generate an anti-cheat session token valid for a short time
        const token = Math.random().toString(36).substring(2, 15);
        activeSessions.set(ip, { token, expires: Date.now() + 1000 * 60 * 15 }); // 15 minute limit per game

        res.json({ remaining: MAX_ATTEMPTS - (used + 1), token });
    } catch (e) {
        console.error('Error starting attempt:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Main entry point
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint to get leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const lb = await db.collection('leaderboard')
            .find({})
            .sort({ score: -1 })
            .limit(50)
            .project({ handle: 1, score: 1, timestamp: 1, _id: 0 })
            .toArray();
        res.json(lb);
    } catch (e) {
        console.error('Error reading leaderboard:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Endpoint to post a new score
app.post('/api/leaderboard', async (req, res) => {
    try {
        const { handle, score, token } = req.body;
        const ip = req.ip;

        if (!handle || typeof score !== 'number' || !token) {
            return res.status(400).json({ error: 'Invalid data format or missing token' });
        }

        // Verify Anti-Cheat Token
        const session = activeSessions.get(ip);
        if (!session || session.token !== token || session.expires < Date.now()) {
            return res.status(403).json({ error: 'Invalid or expired game session. Suspicious activity blocked.' });
        }

        // Invalidate the token so they can't submit multiple scores off one attempt
        activeSessions.delete(ip);

        const cleanHandle = handle.toLowerCase().replace('@', '');
        const fullHandle = handle.startsWith('@') ? handle : '@' + handle;

        // Check if this IP + handle combo already has a score
        // This ties each handle to the device/IP that created it
        const existing = await db.collection('leaderboard').findOne({
            ip: ip,
            handle: { $regex: new RegExp(`^@?${cleanHandle}$`, 'i') }
        });

        if (existing) {
            // Only update if new score is higher
            if (score > existing.score) {
                await db.collection('leaderboard').updateOne(
                    { _id: existing._id },
                    { $set: { score, timestamp: Date.now() } }
                );
            }
        } else {
            await db.collection('leaderboard').insertOne({
                handle: fullHandle,
                ip: ip,
                score,
                timestamp: Date.now()
            });
        }

        // Return updated leaderboard (without IP for privacy)
        const lb = await db.collection('leaderboard')
            .find({})
            .sort({ score: -1 })
            .limit(50)
            .project({ handle: 1, score: 1, timestamp: 1, _id: 0 })
            .toArray();

        res.json(lb);
    } catch (e) {
        console.error('Error saving score:', e);
        res.status(500).json({ error: 'Failed to save score' });
    }
});

// ══════════════════════════════════════════
//  START SERVER (connect to DB first)
// ══════════════════════════════════════════
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Global Leaderboard Backend API is active.`);
    });
}).catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
});
