import LinkAccountButton from "@/components/dashboard/LinkAccountButton";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">FinanceFlow</h1>
      <div className="p-6 border rounded-lg shadow-sm">
        <p className="mb-4 text-gray-600">
          Get started by connecting to your bank account.
        </p>
        <LinkAccountButton />
      </div>
    </div>
  );
}