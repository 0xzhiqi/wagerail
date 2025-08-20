import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendWageGroupInvitation, sendWageGroupUpdateNotification } from "@/lib/email"

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()
        const { name, startDate, paymentDate, yieldSource, payees } = body

        // Validate required fields
        if (!name || !startDate || !paymentDate || !payees || payees.length === 0) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Check if wage group exists and belongs to user
        const existingWageGroup = await prisma.wageGroup.findFirst({
            where: {
                id: id,
                userId: session.user.id
            }
        })

        if (!existingWageGroup) {
            return NextResponse.json({ error: "Wage group not found" }, { status: 404 })
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

        // Get existing payees to compare for changes
        const existingPayees = await prisma.payee.findMany({
            where: { wageGroupId: id },
            select: { email: true, monthlyAmount: true }
        })

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

        // Update wage group with payees
        const updatedWageGroup = await prisma.wageGroup.update({
            where: { id: id },
            data: {
                name: name.trim(),
                startDate: start,
                paymentDate: paymentDateNum,
                yieldSource: yieldSource || null,
                payees: {
                    deleteMany: {}, // Delete existing payees
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

        // Determine which payees are new or have changes
        const existingEmails = new Set(existingPayees.map(p => p.email))
        const existingPayeeMap = new Map(existingPayees.map(p => [p.email, p.monthlyAmount]))

        const emailPromises = updatedWageGroup.payees.map(async (payee) => {
            try {
                const isNewPayee = !existingEmails.has(payee.email)
                const hasAmountChanged = existingPayeeMap.get(payee.email) !== payee.monthlyAmount

                if (isNewPayee) {
                    // Send invitation email to new payees
                    await sendWageGroupInvitation({
                        recipientEmail: payee.email,
                        inviterName: inviterName,
                        wageGroupName: updatedWageGroup.name,
                        monthlyAmount: payee.monthlyAmount
                    })
                    console.log(`Invitation email sent to new payee ${payee.email}`)
                } else if (hasAmountChanged) {
                    // Send update notification to existing payees with changes
                    await sendWageGroupUpdateNotification({
                        recipientEmail: payee.email,
                        inviterName: inviterName,
                        wageGroupName: updatedWageGroup.name,
                        monthlyAmount: payee.monthlyAmount,
                        isNewPayee: false
                    })
                    console.log(`Update email sent to ${payee.email}`)
                }
            } catch (error) {
                console.error(`Failed to send email to ${payee.email}:`, error)
                // Don't fail the entire request if email fails
            }
        })

        // Wait for all emails to be sent (but don't block the response)
        Promise.all(emailPromises).catch(error => {
            console.error("Some emails failed to send:", error)
        })

        return NextResponse.json(updatedWageGroup)
    } catch (error) {
        console.error("Error updating wage group:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params

        // Check if wage group exists and belongs to user
        const existingWageGroup = await prisma.wageGroup.findFirst({
            where: {
                id: id,
                userId: session.user.id
            }
        })

        if (!existingWageGroup) {
            return NextResponse.json({ error: "Wage group not found" }, { status: 404 })
        }

        // Delete wage group (payees will be deleted automatically due to cascade)
        await prisma.wageGroup.delete({
            where: { id: id }
        })

        return NextResponse.json({ message: "Wage group deleted successfully" })
    } catch (error) {
        console.error("Error deleting wage group:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}