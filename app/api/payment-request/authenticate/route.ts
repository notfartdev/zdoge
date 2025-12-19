import { type NextRequest, NextResponse } from "next/server"
import { authenticatePaymentRequest } from "@/lib/mixer-service"

export async function POST(request: NextRequest) {
  try {
    const { paymentId, signature } = await request.json()

    if (!paymentId || !signature) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await authenticatePaymentRequest(paymentId, signature)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Authentication failed:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
