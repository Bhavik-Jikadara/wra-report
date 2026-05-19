/**
 * src/lib/db.ts — Prisma client singleton (server-side only)
 *
 * ⚠️  This file MUST NOT be imported by any React component or Vite entry point.
 *     It is intended for use by a separate Express / Next.js API server that shares
 *     this repo's generated Prisma client.
 *
 * Hot-reload safety: reuses a single PrismaClient instance across module reloads
 * in development by pinning it to globalThis.
 */

// Run `npx prisma generate` once before importing this file.
import { PrismaClient } from '../generated/prisma';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
    errorFormat: 'pretty',
  });
}

export const prisma: PrismaClient =
  globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
