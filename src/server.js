const app = require('./app');
const env = require('./config/env');
const { ensureBucket } = require('./config/s3');
const { migrate } = require('./migrations/migrate');

async function start() {
  console.log('PixelVault API starting...');

  // Run database migrations
  console.log('Running migrations...');
  await migrate();

  // Ensure S3 bucket exists
  console.log('Ensuring S3 bucket exists...');
  await ensureBucket();

  // Start HTTP server
  app.listen(env.PORT, () => {
    console.log(`PixelVault API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
