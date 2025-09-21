import 'express-session'

declare module 'express-session' {
  interface SessionData {
    profile?: {
      email: string
      id: string
    }
  }
}
