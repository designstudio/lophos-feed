import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET — listar todas as aliases
export async function GET() {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('topic_aliases')
    .select('*')
    .order('canonical_topic', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ aliases: data })
}

// POST — adicionar ou atualizar um alias
export async function POST(req: NextRequest) {
  const db = getSupabaseAdmin()
  const { canonical_topic, aliases } = await req.json()

  if (!canonical_topic || !Array.isArray(aliases)) {
    return NextResponse.json(
      { error: 'canonical_topic e aliases array são obrigatórios' },
      { status: 400 }
    )
  }

  const { data, error } = await db
    .from('topic_aliases')
    .upsert(
      {
        canonical_topic: canonical_topic.toLowerCase().trim(),
        aliases: aliases.map((a: string) => a.toLowerCase().trim()),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'canonical_topic' }
    )
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, alias: data?.[0] })
}

// DELETE — remover um alias (manter o canônico)
export async function DELETE(req: NextRequest) {
  const db = getSupabaseAdmin()
  const { canonical_topic } = await req.json()

  if (!canonical_topic) {
    return NextResponse.json({ error: 'canonical_topic é obrigatório' }, { status: 400 })
  }

  const { error } = await db
    .from('topic_aliases')
    .delete()
    .eq('canonical_topic', canonical_topic.toLowerCase().trim())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
