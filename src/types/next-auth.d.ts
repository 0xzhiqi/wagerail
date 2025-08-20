import { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      walletAddress?: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    walletAddress?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    uid?: string
    walletAddress?: string
  }
}