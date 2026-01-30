import Dashboard from "@/components/dashboard/Dashboard";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">FinanceFlow</h1>
      <Dashboard />
    </div>
  );
}