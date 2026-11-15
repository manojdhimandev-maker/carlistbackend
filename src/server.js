const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const seedData = require('./utils/seed');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await seedData();

    const server = http.createServer(app);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Fawmond Galaxy Backend listening on port ${PORT}`);
    });

    const shutdown = () => {
      console.log('\n[Server] Shutting down gracefully...');
      server.close(() => {
        console.log('[Server] Closed connections.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[Server] Fatal startup error:', error);
    process.exit(1);
  }
};

startServer();
