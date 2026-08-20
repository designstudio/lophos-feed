import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { authorizeAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

const BUCKET = 'editorial-media'
const MAX_FILE_SIZE = 8 * 1024 * 1024
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

export async function POST(req: NextRequest) {
  const access = await authorizeAdmin()
  if (!access.ok) return access.response

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Selecione uma imagem.' }, { status: 400 })
  }

  const extension = MIME_EXTENSIONS[file.type]
  if (!extension) {
    return NextResponse.json({ error: 'Formato não permitido. Use JPG, PNG, WebP ou AVIF.' }, { status: 415 })
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'A imagem deve ter no máximo 8 MB.' }, { status: 413 })
  }

  const now = new Date()
  const path = [
    access.userId,
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    `${randomUUID()}.${extension}`,
  ].join('/')

  const db = getSupabaseAdmin()
  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    })

  if (error) {
    console.error('[admin/lists/upload] upload failed:', error)
    return NextResponse.json({ error: 'Não foi possível enviar a imagem.' }, { status: 500 })
  }

  const { data } = db.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({
    image: {
      url: data.publicUrl,
      path,
      mimeType: file.type,
      size: file.size,
    },
  }, { status: 201 })
}
