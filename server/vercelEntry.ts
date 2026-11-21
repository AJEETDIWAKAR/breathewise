import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express, Request, Response } from 'express';
import { createApiApp } from './app.ts';
import { loadServerConfig } from './config/env.ts';

let cachedApp: Express | null = null;

function getApp(): Express {
  if (!cachedApp) {
    cachedApp = createApiApp(loadServerConfig()).app;
  }
  return cachedApp;
}

export function normalizeVercelApiUrl(rawUrl: string): string {
  const url = new URL(rawUrl || '/', 'http://localhost');
  const bwPath = url.searchParams.get('__bw_path');
  if (bwPath !== null) {
    url.searchParams.delete('__bw_path');
    const cleanSubPath = bwPath.replace(/^\/+/, '');
    const queryStr = url.searchParams.toString();
    return `/api/${cleanSubPath}${queryStr ? `?${queryStr}` : ''}`;
  }
  return rawUrl || '/';
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  req.url = normalizeVercelApiUrl(req.url ?? '/');
  getApp()(req as Request, res as Response);
}
