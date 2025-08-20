import NextAuth from "next-auth"
import { prisma } from "./prisma"
import type { NextAuthConfig } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const config = {
    providers: [
        CredentialsProvider({
            id: "wallet",
            name: "Wallet",
            credentials: {
                email: { label: "Email", type: "email" },
                walletAddress: { label: "Wallet Address", type: "text" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.walletAddress) {
                    return null
                }

                try {
                    // Check if user exists by email or wallet address
                    let user = await prisma.user.findFirst({
                        where: {
                            OR: [
                                { email: credentials.email as string },
                                { walletAddress: credentials.walletAddress as string }
                            ]
                        }
                    })

                    if (user) {
                        // Update existing user
                        user = await prisma.user.update({
                            where: { id: user.id },
                            data: {
                                email: credentials.email as string,
                                walletAddress: credentials.walletAddress as string,
                                updatedAt: new Date()
                            }
                        })
                    } else {
                        // Create new user
                        user = await prisma.user.create({
                            data: {
                                email: credentials.email as string,
                                walletAddress: credentials.walletAddress as string,
                                emailVerified: new Date(),
                            }
                        })
                    }

                    // Link any existing payee records to this user
                    await prisma.payee.updateMany({
                        where: {
                            email: credentials.email as string,
                            userId: null // Only update unlinked payees
                        },
                        data: {
                            userId: user.id
                        }
                    })

                    return {
                        id: user.id,
                        email: user.email || undefined,
                        walletAddress: user.walletAddress || undefined,
                    }
                } catch (error) {
                    console.error("Error in wallet auth:", error)
                    return null
                }
            }
        })
    ],
    callbacks: {
        async session({ session, token }) {
            if (token) {
                session.user.id = token.uid as string
                session.user.walletAddress = token.walletAddress as string
            }
            return session
        },
        async jwt({ user, token }) {
            if (user) {
                token.uid = user.id
                if ('walletAddress' in user) {
                    token.walletAddress = user.walletAddress
                }
            }
            return token
        },
    },
    session: {
        strategy: "jwt" as const,
    },
    pages: {
        signIn: "/",
    },
} satisfies NextAuthConfig

export const { handlers, signIn, signOut, auth } = NextAuth(config)