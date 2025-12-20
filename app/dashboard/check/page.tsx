import { DashboardNav } from "@/components/dashboard-nav"
import { CheckNoteStatus } from "@/components/check-note-status"

export default function CheckPage() {
  return (
    <div className="min-h-screen bg-black">
      <DashboardNav />
      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="font-mono text-3xl font-bold text-white mb-2">Check Note Status</h1>
          <p className="font-mono text-sm text-gray-500">
            Verify if your deposit note has been withdrawn or is still available
          </p>
        </div>
        <CheckNoteStatus />
      </main>
    </div>
  )
}

