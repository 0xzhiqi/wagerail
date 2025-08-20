import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Find all payee records for this user
        const payeeRecords = await prisma.payee.findMany({
            where: {
                OR: [
                    { userId: session.user.id }, // Direct user link
                    { email: session.user.email || "" } // Email match for unlinked payees
                ]
            },
            include: {
                wageGroup: {
                    select: {
                        id: true,
                        name: true,
                        startDate: true,
                        paymentDate: true,
                        yieldSource: true,
                        isActive: true,
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        // Link unlinked payee records to this user if they match by email
        const unlinkedRecords = payeeRecords.filter(record => 
            !record.userId && record.email === session.user.email
        )

        if (unlinkedRecords.length > 0) {
            await Promise.all(unlinkedRecords.map(record =>
                prisma.payee.update({
                    where: { id: record.id },
                    data: { userId: session.user.id }
                })
            ))
        }

        return NextResponse.json(payeeRecords)
    } catch (error) {
        console.error("Error fetching payee payments:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}