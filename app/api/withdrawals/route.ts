import { type NextRequest, NextResponse } from "next/server"
import { createWithdrawal } from "@/lib/mixer-service"

export async function POST(request: NextRequest) {
  try {
    const { amount, secret, nullifier, recipientAddress } = await request.json()

    if (!amount || !secret || !nullifier || !recipientAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const withdrawal = await createWithdrawal(amount, secret, nullifier, recipientAddress)

    return NextResponse.json(withdrawal)
  } catch (error) {
    console.error("Withdrawal failed:", error)
    return NextResponse.json({ error: "Failed to process withdrawal" }, { status: 500 })
  }
}
