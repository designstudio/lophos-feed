import { NextRequest, NextResponse } from 'next/server'
import { authorizeAdmin } from '@/lib/admin-auth'
import { validateEditorialListInput } from '@/lib/editorial-lists'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function getId(context: RouteContext): Promise<string | null> {
  const { id } = await context.params
  return isUuid(id) ? id : null
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const access = await authorizeAdmin()
  if (!access.ok) return access.response

  const id = await getId(context)
  if (!id) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const { data, error } = await getSupabaseAdmin()
    .from('editorial_lists')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[admin/lists/:id] load failed:', error)
    return NextResponse.json({ error: 'Não foi possível carregar a lista.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Lista não encontrada.' }, { status: 404 })

  return NextResponse.json({ list: data })
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const access = await authorizeAdmin()
  if (!access.ok) return access.response

  const id = await getId(context)
  if (!id) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const validation = validateEditorialListInput(body, true)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  if (Object.keys(validation.value).length === 0) {
    return NextResponse.json({ error: 'Nenhuma alteração informada.' }, { status: 400 })
  }

  const db = getSupabaseAdmin()
  const { data: existing, error: existingError } = await db
    .from('editorial_lists')
    .select('id, published_at')
    .eq('id', id)
    .maybeSingle()

  if (existingError) {
    console.error('[admin/lists/:id] pre-update lookup failed:', existingError)
    return NextResponse.json({ error: 'Não foi possível salvar a lista.' }, { status: 500 })
  }
  if (!existing) return NextResponse.json({ error: 'Lista não encontrada.' }, { status: 404 })

  const updates: Record<string, unknown> = { ...validation.value }
  if (updates.status === 'published' && !existing.published_at) {
    updates.published_at = new Date().toISOString()
  }

  const { data, error } = await db
    .from('editorial_lists')
    .update(updates)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error?.code === '23505') {
    return NextResponse.json({ error: 'Já existe uma lista com esse slug.' }, { status: 409 })
  }
  if (error) {
    console.error('[admin/lists/:id] update failed:', error)
    return NextResponse.json({ error: 'Não foi possível salvar a lista.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Lista não encontrada.' }, { status: 404 })

  return NextResponse.json({ list: data })
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const access = await authorizeAdmin()
  if (!access.ok) return access.response

  const id = await getId(context)
  if (!id) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const { data, error } = await getSupabaseAdmin()
    .from('editorial_lists')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[admin/lists/:id] delete failed:', error)
    return NextResponse.json({ error: 'Não foi possível excluir a lista.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Lista não encontrada.' }, { status: 404 })

  return NextResponse.json({ deleted: true, id: data.id })
}
