import { sql } from '../db.js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const result = await sql`
      INSERT INTO users (email)
      VALUES (${email})
      ON CONFLICT (email)
      DO UPDATE SET email = ${email}
      RETURNING id
    `

    const user = result[0]
    return new Response(
      JSON.stringify({ userId: user.id }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error authenticating:', error)
    return new Response(JSON.stringify({ error: 'Authentication failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
