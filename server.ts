import fs from 'fs';
import path from 'path';
import express from 'express';
import { createApiApp } from './server/app.ts';
import { loadServerConfig } from './server/config/env.ts';
import { logInfo } from './server/utils/logger.ts';

async function startServer() {
  const config = loadServerConfig();
  const { app } = createApiApp(config);

  if (config.nodeEnv !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(
        '/assets',
        express.static(path.join(distDir, 'assets'), {
          maxAge: '1y',
          immutable: true,
        }),
      );
      app.use(express.static(distDir, { index: false }));
      app.get('*', (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(config.port, '0.0.0.0', () => {
    logInfo('Server', `BreatheWise full-stack server listening on port ${config.port}`, {
      mode: config.nodeEnv,
      primaryAqiProvider: 'airlive (no API key required)',
      cacheTtlMs: config.aqiCacheTtlMs,
      geminiConfigured: Boolean(config.geminiApiKey),
    });
  });
}

startServer();
