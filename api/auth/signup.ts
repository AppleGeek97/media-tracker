import { sql } from '../db.js'
import bcrypt from 'bcryptjs'
import {
  generateAccessToken,
  generateRefreshToken,
  type TokenPayload,
} from '../lib/auth.js'
import { checkRateLimit, getClientIP } from '../lib/rate-limit.js'

export async function POST(request: Request) {
  // Rate limiting: 5 signup attempts per 15 minutes per IP
  const clientIP = getClientIP(request)
  const rateLimit = await checkRateLimit(`signup:${clientIP}`, 5, 15)

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many signup attempts. Please try again later.',
        resetAt: rateLimit.resetAt
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': rateLimit.resetAt
            ? Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000).toString()
            : '900'
        },
      }
    )
  }

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

    // Validate password with strength requirements
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

    // Password strength validation: must contain uppercase, lowercase, number, and special char
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return new Response(
        JSON.stringify({
          error: 'Password must contain uppercase, lowercase, number, and special character'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Common weak passwords check
    const commonPasswords = ['password', '12345678', 'qwerty123', 'abc12345', 'monkey123', 'password123']
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      return new Response(
        JSON.stringify({ error: 'Password is too common. Choose a stronger password.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if username already exists - return generic error to prevent enumeration
    const existingUsers = await sql`
      SELECT id FROM users WHERE username = ${username}
    `

    if (existingUsers.length > 0) {
      // Generic message - prevents username enumeration
      return new Response(JSON.stringify({
        error: 'If an account with this username exists, it has already been created'
      }), {
        status: 200,
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
