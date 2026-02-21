import { sql } from './api/db.js'

async function migrate() {
  console.log('Starting sync feature migration...')

  // Add updated_at column to media_entries for sync functionality
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'media_entries' AND column_name = 'updated_at'
      ) THEN
        ALTER TABLE media_entries ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      END IF;
    END $$;
  `

  console.log('- media_entries.updated_at column added')

  // Backfill existing entries with created_at as updated_at
  await sql`
    UPDATE media_entries
    SET updated_at = created_at
    WHERE updated_at IS NULL
  `

  console.log('- Backfilled existing entries')

  // Create index for sync performance
  await sql`
    CREATE INDEX IF NOT EXISTS idx_media_entries_updated_at
    ON media_entries(user_id, updated_at)
  `

  console.log('- Index created on updated_at')

  console.log('Migration completed successfully!')
  process.exit(0)
}

migrate().catch(console.error)
