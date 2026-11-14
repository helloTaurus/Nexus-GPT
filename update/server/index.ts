import http from 'node:http';
import { createApp } from './app.ts';
import { envConfig } from './config/index.ts';
import { initializeDataStore, closeDataStore } from './repositories/dataStore.ts';

async function bootstrap() {
  console.log(`[Bootstrap] Initializing Nexus Finance HRMS Server (Environment: ${envConfig.NODE_ENV})...`);

  // Step 1: Initialize persistent data store
  try {
    await initializeDataStore();
    console.log('[Bootstrap] Persistent data store initialized and verified.');
  } catch (storeError) {
    console.error('[Bootstrap] Fatal error initializing data store:', storeError);
    process.exit(1);
  }

  // Step 2: Create Express application instance
  const app = createApp();
  const server = http.createServer(app);

  const PORT = envConfig.PORT;
  const HOST = envConfig.HOST;

  // Step 3: Bind HTTP listener
  server.listen(PORT, HOST, () => {
    console.log(`======================================================`);
    console.log(` Nexus Finance Backend Service Running`);
    console.log(` Address: http://${HOST}:${PORT}`);
    console.log(` Health:  http://${HOST}:${PORT}/api/v1/health`);
    console.log(`======================================================`);
  });

  // Step 4: Graceful Shutdown Orchestration
  let isShuttingDown = false;

  async function handleGracefulShutdown(signal: string, exitCode = 0) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[Process] Received ${signal}. Starting graceful shutdown sequence...`);

    const forceTimer = setTimeout(() => {
      console.error('[Process] Forceful shutdown initiated due to timeout (10s). Active sockets remained.');
      process.exit(1);
    }, 10000);
    forceTimer.unref();

    server.close(async (err) => {
      if (err) {
        console.error('[Process] Error closing HTTP server listener:', err);
        process.exit(1);
      }
      console.log('[Process] HTTP listener closed. Active connections drained.');

      try {
        await closeDataStore();
        console.log('[Process] Storage handles synchronized and closed.');
      } catch (flushErr) {
        console.error('[Process] Error during data store cleanup:', flushErr);
      }

      console.log('[Process] Graceful shutdown completed. Exiting process.');
      process.exit(exitCode);
    });
  }

  process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM', 0));
  process.on('SIGINT', () => handleGracefulShutdown('SIGINT', 0));

  process.on('uncaughtException', (error) => {
    console.error('[Process] FATAL Uncaught Exception:', error);
    handleGracefulShutdown('uncaughtException', 1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Process] FATAL Unhandled Promise Rejection:', reason);
    handleGracefulShutdown('unhandledRejection', 1);
  });
}

bootstrap();
