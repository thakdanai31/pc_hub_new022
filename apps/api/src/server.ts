import { env } from './config/env.js';
import { app } from './app.js';
import { prisma } from './config/database.js';

const server = app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
});

async function shutdown(): Promise<void> {
  console.log('Shutting down...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
