import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import os from 'os'

function getDatabaseUrl(): string {
  // If an external database URL is explicitly configured (e.g. Postgres, MySQL, Turso), use it
  if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.startsWith('file:') &&
    !process.env.DATABASE_URL.includes('dev.db')
  ) {
    return process.env.DATABASE_URL
  }

  // Detect Vercel / Serverless production runtime
  const isServerless =
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.NETLIFY) ||
    (process.env.NODE_ENV === 'production' && process.platform !== 'win32')

  if (isServerless && typeof window === 'undefined') {
    const tmpDir = process.env.VERCEL ? '/tmp' : os.tmpdir()
    const tmpDbPath = path.join(tmpDir, 'dev.db')

    try {
      if (!fs.existsSync(tmpDbPath)) {
        // Seed from pre-migrated SQLite DB in repository if available
        const candidatePaths = [
          path.join(process.cwd(), 'prisma', 'dev.db'),
          path.join(process.cwd(), 'dev.db'),
        ]

        let copied = false
        for (const candidate of candidatePaths) {
          if (fs.existsSync(candidate)) {
            try {
              fs.copyFileSync(candidate, tmpDbPath)
              copied = true
              break
            } catch {
              // ignore copy error and proceed
            }
          }
        }

        if (!copied) {
          fs.writeFileSync(tmpDbPath, '')
        }
      }

      const formattedPath = tmpDbPath.replace(/\\/g, '/')
      return `file:${formattedPath}`
    } catch (err) {
      console.warn('Error setting up /tmp/dev.db in serverless environment:', err)
      return 'file:/tmp/dev.db'
    }
  }

  // Local development default
  return process.env.DATABASE_URL || 'file:./dev.db'
}

const activeDbUrl = getDatabaseUrl()

if (process.env.VERCEL) {
  process.env.DATABASE_URL = activeDbUrl
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: activeDbUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined
} & typeof global

export const db = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = db

let schemaInitialized = false

/**
 * Ensures the SQLite tables exist in the target database (/tmp/dev.db or local)
 * safely and idempotently without throwing unhandled exceptions.
 */
export async function ensureDbSchema(): Promise<void> {
  if (schemaInitialized) return
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "sessionId" TEXT NOT NULL,
        "videoId" TEXT NOT NULL,
        "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endTime" DATETIME,
        "duration" INTEGER NOT NULL DEFAULT 0,
        "focusTime" INTEGER NOT NULL DEFAULT 0,
        "averageFocus" REAL NOT NULL DEFAULT 0,
        "emotionTimeline" TEXT,
        "events" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "QuizResult" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "sessionId" TEXT NOT NULL,
        "score" REAL NOT NULL DEFAULT 0,
        "totalQuestions" INTEGER NOT NULL DEFAULT 0,
        "correctAnswers" INTEGER NOT NULL DEFAULT 0,
        "videoTime" REAL NOT NULL DEFAULT 0,
        "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("sessionId") REFERENCES "Session" ("sessionId") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `)
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionId_key" ON "Session"("sessionId");
    `)
    schemaInitialized = true
  } catch (err) {
    console.warn('SQLite schema auto-initialization note:', err)
  }
}
