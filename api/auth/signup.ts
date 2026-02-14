import { sql } from '../db.js'
import bcrypt from 'bcryptjs'
import {
  generateAccessToken,
  generateRefreshToken,
  type TokenPayload,
} from '../lib/auth.js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password } = body

    // Validate username
    if (!username || typeof username !== 'string') {
      return new Response(JSON.stringify({ error: 'Username is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (username.length < 3 || username.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Username must be between 3 and 50 characters' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if username is alphanumeric (with underscores allowed)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return new Response(
        JSON.stringify({
          error: 'Username can only contain letters, numbers, and underscores',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate password
    if (!password || typeof password !== 'string') {
      return new Response(JSON.stringify({ error: 'Password is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if username already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE username = ${username}
    `

    if (existingUsers.length > 0) {
      return new Response(JSON.stringify({ error: 'Username already taken' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Hash password with bcrypt (salt rounds: 10)
    const password_hash = await bcrypt.hash(password, 10)

    // Create user
    const result = await sql`
      INSERT INTO users (username, password_hash)
      VALUES (${username}, ${password_hash})
      RETURNING id
    `

    const user = result[0]

    // Generate JWT tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: username,
    }

    const [access_token, refresh_token] = await Promise.all([
      generateAccessToken(tokenPayload),
      generateRefreshToken(tokenPayload),
    ])

    // Store refresh token in database
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

    await sql`
      INSERT INTO refresh_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${refresh_token}, ${expiresAt.toISOString()})
    `

    return new Response(
      JSON.stringify({
        access_token,
        refresh_token,
        userId: user.id,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Signup error:', error)
    return new Response(JSON.stringify({ error: 'Signup failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
