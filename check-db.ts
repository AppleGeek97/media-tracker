import { sql } from './api/db.ts'

async function check() {
  const users = await sql`SELECT id, username FROM users`
  console.log('Users:', users)

  const entries = await sql`SELECT user_id, COUNT(*) as count FROM media_entries GROUP BY user_id`
  console.log('Entries by user:', entries)

  process.exit(0)
}

check().catch(console.error)
