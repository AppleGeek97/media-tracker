/**
 * Simple password check endpoint
 * Validates password server-side to keep it secure from client inspection
 */

const correctPassword = process.env.SITE_PASSWORD

if (!correctPassword) {
  throw new Error('SITE_PASSWORD environment variable is not set')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { password } = body

    // Rate limiting: 20 attempts per minute per IP
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitKey = `password-check:${clientIP}`

    // Simple in-memory rate limiting (for production, use Redis or similar)
    const attempts = (global as any)._passwordAttempts || (global as any)._passwordAttempts = new Map()
    const now = Date.now()
    const userAttempts = attempts.get(rateLimitKey) || { count: 0, resetTime: now + 60000 }

    if (now > userAttempts.resetTime) {
      userAttempts.count = 0
      userAttempts.resetTime = now + 60000
    }

    if (userAttempts.count >= 20) {
      return new Response(
        JSON.stringify({
          error: 'Too many attempts. Please try again later.',
          resetAt: userAttempts.resetTime
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60'
          }
        }
      )
    }

    userAttempts.count++
    attempts.set(rateLimitKey, userAttempts)

    // Check password
    if (password === correctPassword) {
      // Reset attempts on success
      attempts.delete(rateLimitKey)

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Incorrect password' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Password check error:', error)
    return new Response(
      JSON.stringify({ error: 'Password check failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
