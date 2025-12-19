import { type NextRequest, NextResponse } from "next/server"
import { updateRPCProvider } from "@/lib/mixer-service"

export async function POST(request: NextRequest) {
  try {
    const { rpcUrl } = await request.json()

    if (!rpcUrl) {
      return NextResponse.json({ error: "RPC URL is required" }, { status: 400 })
    }

    await updateRPCProvider(rpcUrl)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update RPC provider:", error)
    return NextResponse.json({ error: "Failed to update RPC provider" }, { status: 500 })
  }
}
