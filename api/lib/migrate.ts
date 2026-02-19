/**
 * Database migration script
 * Run this to ensure your database schema is up to date
 */

import { sql } from '../db.js'

export async function migrateDatabase() {
  try {
    console.log('Starting database migration...')

    // Add revoked_at column to refresh_tokens if it doesn't exist
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'refresh_tokens' AND column_name = 'revoked_at'
        ) THEN
          ALTER TABLE refresh_tokens ADD COLUMN revoked_at TIMESTAMP WITH TIME ZONE;
        END IF;
      END $$;
    `

    console.log('Migration completed successfully!')
    console.log('- refresh_tokens.revoked_at column added (if missing)')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
