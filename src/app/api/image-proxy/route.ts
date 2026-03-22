import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new Response('Missing url', { status: 400 })

  let target: URL
  try {
    target = new URL(url)
  } catch {
    return new Response('Invalid url', { status: 400 })
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    return new Response('Unsupported protocol', { status: 400 })
  }

  try {
    const res = await fetch(target.toString(), {
      headers: {
        // Mimic a real browser to reduce hotlink blocks
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': target.origin,
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return new Response(`Upstream error: ${res.status}`, { status: 502 })
    }

    const contentType = res.headers.get('content-type') ?? 'image/jpeg'

    // GIFs são quase sempre lazy-load placeholders em sites de notícia
    if (contentType.includes('image/gif')) {
      return new Response('Lazy-load placeholder detected', { status: 422 })
    }

    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new Response('Proxy fetch failed', { status: 502 })
  }
}

