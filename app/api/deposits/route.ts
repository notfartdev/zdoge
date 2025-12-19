import { type NextRequest, NextResponse } from "next/server"
import { createDeposit } from "@/lib/mixer-service"

export async function POST(request: NextRequest) {
  try {
    const { amount, address } = await request.json()

    if (!amount || !address) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const deposit = await createDeposit(amount, address)

    return NextResponse.json({
      ...deposit,
      depositId: deposit.id,
    })
  } catch (error) {
    console.error("Deposit creation failed:", error)
    return NextResponse.json({ error: "Failed to create deposit" }, { status: 500 })
  }
}
