import { type NextRequest, NextResponse } from "next/server"
import { getPaymentRequest } from "@/lib/mixer-service"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const paymentId = params.id

    if (!paymentId) {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 })
    }

    const paymentRequest = await getPaymentRequest(paymentId)

    // Return limited info before authentication
    return NextResponse.json({
      id: paymentRequest.depositId,
      amount: paymentRequest.amount,
      authenticated: paymentRequest.authenticated,
      timestamp: paymentRequest.timestamp,
    })
  } catch (error) {
    console.error("Failed to get payment request:", error)
    return NextResponse.json({ error: "Payment request not found" }, { status: 404 })
  }
}
