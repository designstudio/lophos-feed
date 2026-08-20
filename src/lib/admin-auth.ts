import 'server-only'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'

type SessionClaimsWithMetadata = {
  metadata?: {
    role?: unknown
  }
}

export type AdminAccess =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

export type AdminIdentity = {
  id: string
  name: string
  imageUrl: string | null
}

export function getSessionRole(sessionClaims: unknown): string | null {
  const role = (sessionClaims as SessionClaimsWithMetadata | null)?.metadata?.role
  return typeof role === 'string' ? role.trim().toLowerCase() : null
}

export async function authorizeAdmin(): Promise<AdminAccess> {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (getSessionRole(sessionClaims) !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true, userId }
}

export async function requireAdminPage(): Promise<{ userId: string }> {
  const { userId, sessionClaims } = await auth()

  if (!userId) redirect('/login')
  if (getSessionRole(sessionClaims) !== 'admin') redirect('/feed')

  return { userId }
}

export async function getAdminIdentity(userId: string): Promise<AdminIdentity> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    || user.username
    || 'Editor Lophos'

  return {
    id: user.id,
    name,
    imageUrl: user.imageUrl || null,
  }
}
