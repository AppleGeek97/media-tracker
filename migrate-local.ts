import { sql } from './api/db.ts'

async function migrate() {
  // Get the single user
  const users = await sql`SELECT id FROM users LIMIT 1`
  if (users.length === 0) {
    console.log('No user found')
    process.exit(1)
  }
  const userId = users[0].id
  console.log('Using user:', userId)

  // Check current entries
  const entries = await sql`SELECT * FROM media_entries`
  console.log('Current entries in DB:', entries.length)

  if (entries.length === 0) {
    console.log('No entries in database. You may need to import from localStorage.')
    console.log('Check browser localStorage for keys:')
    console.log('  - media-logbook-backlog')
    console.log('  - media-logbook-futurelog')
  }

  process.exit(0)
}

migrate().catch(console.error)
