import { DashboardNav } from "@/components/dashboard-nav"
import { WalletSettings } from "@/components/wallet-settings"
import { NoteAccountSettings } from "@/components/note-account-settings"

export default function AccountPage() {
  return (
    <div className="min-h-screen bg-black">
      <DashboardNav />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="font-mono text-4xl font-bold mb-8 text-white">Account</h1>
        <div className="space-y-8">
          <WalletSettings />
          <NoteAccountSettings />
        </div>
      </main>
    </div>
  )
}
