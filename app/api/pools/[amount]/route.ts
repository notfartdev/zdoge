import { type NextRequest, NextResponse } from "next/server"
import { getPoolStats } from "@/lib/mixer-service"

export async function GET(request: NextRequest, { params }: { params: { amount: string } }) {
  try {
    const amount = Number.parseInt(params.amount)
    const stats = await getPoolStats(amount)

    return NextResponse.json(stats)
  } catch (error) {
    console.error("Failed to get pool stats:", error)
    return NextResponse.json({ error: "Failed to get pool stats" }, { status: 500 })
  }
}
