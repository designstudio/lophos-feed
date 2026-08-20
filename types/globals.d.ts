export {}

export type AppRole = 'admin'

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: AppRole
    }
  }
}
