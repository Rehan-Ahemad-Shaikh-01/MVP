import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { seedDatabase } from './db/seed.js';
import { db } from './db/store.js';
import { router } from './routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API base route
app.use('/api', router);

// Root greeting & API info
app.get('/', (_req, res) => {
  res.json({
    name: 'GrouptripLedger API',
    version: '1.0.0',
    description: 'Itinerary-aware group travel coordination and dynamic settlement ledger',
    endpoints: {
      health: '/api/health',
      trips: '/api/trips',
      seed: '/api/seed',
    },
  });
});

// Auto-seed if database is fresh/empty
if (db.getTrips().length === 0) {
  console.log('Database empty. Seeding initial demo data...');
  seedDatabase();
}

app.listen(PORT, () => {
  console.log(`🚀 GrouptripLedger API Server running at http://localhost:${PORT}`);
});

export default app;
