import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const USER_DATA_TABLES = [
  'user_reactions',
  'user_negative_topics',
  'user_excluded_topics',
  'user_topics',
  'editorial_list_reactions',
] as const

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (body?.confirmation !== 'delete-account') {
    return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  // Keep the Clerk identity alive until all application data is gone. These
  // deletes are idempotent, so a failed attempt can safely be retried.
  for (const table of USER_DATA_TABLES) {
    const { error } = await db.from(table).delete().eq('user_id', userId)
    if (error) {
      console.error(`[account] Failed to delete user data from ${table}:`, error)
      return NextResponse.json({ error: 'Não foi possível excluir todos os dados da conta.' }, { status: 500 })
    }
  }

  try {
    const client = await clerkClient()
    await client.users.deleteUser(userId)
  } catch (error) {
    console.error('[account] Failed to delete Clerk user:', error)
    return NextResponse.json({ error: 'Os dados foram removidos, mas não foi possível finalizar a exclusão da conta.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
