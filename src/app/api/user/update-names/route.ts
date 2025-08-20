import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { firstName, middleName, lastName } = body

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                firstName: firstName || null,
                middleName: middleName || null,
                lastName: lastName || null,
                updatedAt: new Date()
            },
            select: {
                id: true,
                email: true,
                walletAddress: true,
                firstName: true,
                middleName: true,
                lastName: true,
            }
        })

        return NextResponse.json(updatedUser)
    } catch (error) {
        console.error("Error updating user names:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}