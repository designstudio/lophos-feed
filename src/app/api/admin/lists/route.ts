import { NextRequest, NextResponse } from 'next/server'
import { authorizeAdmin, getAdminIdentity } from '@/lib/admin-auth'
import {
  EDITORIAL_LIST_STATUSES,
  EDITORIAL_LIST_SUMMARY_COLUMNS,
  validateEditorialListInput,
} from '@/lib/editorial-lists'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const access = await authorizeAdmin()
  if (!access.ok) return access.response

  const status = req.nextUrl.searchParams.get('status')?.trim().toLowerCase() || ''
  if (status && !EDITORIAL_LIST_STATUSES.includes(status as (typeof EDITORIAL_LIST_STATUSES)[number])) {
    return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
  }

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 50, 1), 100)
  let query = getSupabaseAdmin()
    .from('editorial_lists')
    .select(EDITORIAL_LIST_SUMMARY_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('[admin/lists] list failed:', error)
    return NextResponse.json({ error: 'Não foi possível carregar as listas.' }, { status: 500 })
  }

  return NextResponse.json({ lists: data || [] })
}

export async function POST(req: NextRequest) {
  const access = await authorizeAdmin()
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const validation = validateEditorialListInput(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  let author
  try {
    author = await getAdminIdentity(access.userId)
  } catch (error) {
    console.error('[admin/lists] Clerk profile lookup failed:', error)
    return NextResponse.json({ error: 'Não foi possível identificar o editor.' }, { status: 502 })
  }

  const record: Record<string, unknown> = {
    ...validation.value,
    author_clerk_id: author.id,
    author_name: author.name,
    author_image_url: author.imageUrl,
  }

  if (record.status === 'published') {
    record.published_at = new Date().toISOString()
  }

  const { data, error } = await getSupabaseAdmin()
    .from('editorial_lists')
    .insert(record)
    .select('*')
    .single()

  if (error?.code === '23505') {
    return NextResponse.json({ error: 'Já existe uma lista com esse slug.' }, { status: 409 })
  }
  if (error) {
    console.error('[admin/lists] create failed:', error)
    return NextResponse.json({ error: 'Não foi possível criar a lista.' }, { status: 500 })
  }

  return NextResponse.json({ list: data }, { status: 201 })
}
