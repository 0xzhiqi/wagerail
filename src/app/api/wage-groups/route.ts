import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendWageGroupInvitation } from "@/lib/email"

export async function POST(request: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { name, startDate, paymentDate, yieldSource, payees } = body

        // Validate required fields
        if (!name || !startDate || !paymentDate || !payees || payees.length === 0) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Validate start date is in the future
        const start = new Date(startDate)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        if (start <= today) {
            return NextResponse.json({ error: "Start date must be in the future" }, { status: 400 })
        }

        // Validate payment date
        const paymentDateNum = parseInt(paymentDate)
        if (paymentDateNum < 1 || paymentDateNum > 31) {
            return NextResponse.json({ error: "Payment date must be between 1 and 31" }, { status: 400 })
        }

        // Validate first payment date is in the future
        const firstPaymentDate = new Date(start.getFullYear(), start.getMonth(), paymentDateNum)
        if (firstPaymentDate <= today) {
            // If the payment date in the start month has passed, check next month
            const nextMonthPayment = new Date(start.getFullYear(), start.getMonth() + 1, paymentDateNum)
            if (nextMonthPayment <= today) {
                return NextResponse.json({ error: "First payment date must be in the future" }, { status: 400 })
            }
        }

        // Validate payees
        for (const payee of payees) {
            if (!payee.email || !payee.monthlyAmount) {
                return NextResponse.json({ error: "Each payee must have email and monthly amount" }, { status: 400 })
            }

            if (payee.monthlyAmount <= 0) {
                return NextResponse.json({ error: "Monthly amount must be greater than 0" }, { status: 400 })
            }

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(payee.email)) {
                return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
            }
        }

        // Validate yield source if provided
        const validYieldSources = ["re7-labs", "k3-capital", "mev-capital-avalanche"]
        if (yieldSource && !validYieldSources.includes(yieldSource)) {
            return NextResponse.json({ error: "Invalid yield source" }, { status: 400 })
        }

        // Get the current user's name for the email
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                firstName: true,
                lastName: true,
                email: true
            }
        })

        const inviterName = currentUser?.firstName && currentUser?.lastName 
            ? `${currentUser.firstName} ${currentUser.lastName}`
            : currentUser?.email || "Someone"

        // Create wage group with payees
        const wageGroup = await prisma.wageGroup.create({
            data: {
                userId: session.user.id,
                name: name.trim(),
                startDate: start,
                paymentDate: paymentDateNum,
                yieldSource: yieldSource || null,
                payees: {
                    create: await Promise.all(payees.map(async (payee: any) => {
                        // Check if a user with this email already exists
                        const existingUser = await prisma.user.findUnique({
                            where: { email: payee.email }
                        })
                        
                        return {
                            email: payee.email,
                            monthlyAmount: parseFloat(payee.monthlyAmount),
                            userId: existingUser?.id || null
                        }
                    }))
                }
            },
            include: {
                payees: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                walletAddress: true
                            }
                        }
                    }
                }
            }
        })

        // Send invitation emails to all payees
        const emailPromises = wageGroup.payees.map(async (payee) => {
            try {
                await sendWageGroupInvitation({
                    recipientEmail: payee.email,
                    inviterName: inviterName,
                    wageGroupName: wageGroup.name,
                    monthlyAmount: payee.monthlyAmount
                })
                console.log(`Invitation email sent to ${payee.email}`)
            } catch (error) {
                console.error(`Failed to send email to ${payee.email}:`, error)
                // Don't fail the entire request if email fails
            }
        })

        // Wait for all emails to be sent (but don't block the response)
        Promise.all(emailPromises).catch(error => {
            console.error("Some emails failed to send:", error)
        })

        return NextResponse.json(wageGroup)
    } catch (error) {
        console.error("Error creating wage group:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const wageGroups = await prisma.wageGroup.findMany({
            where: {
                userId: session.user.id
            },
            include: {
                payees: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                walletAddress: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        return NextResponse.json(wageGroups)
    } catch (error) {
        console.error("Error fetching wage groups:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}