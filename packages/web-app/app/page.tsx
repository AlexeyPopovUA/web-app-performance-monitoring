import ReportsBrowser from '@/components/ReportsBrowser'

export default function Home() {
  return (
    <main className="container py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Performance Reports Dashboard</h1>
        <p className="text-sm text-gray-600">Browse, group, and filter your performance reports.</p>
      </header>

      <ReportsBrowser />
    </main>
  )
}