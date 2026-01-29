"use client";

import { useState } from "react";
import axios from "axios";
import LinkAccountButton from "./LinkAccountButton";
import TransactionList from "./TransactionList";
import SpendingChart from "./SpendingChart";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import AIInsights from "./AIInsights";

export default function Dashboard() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await axios.get("/api/plaid/transactions");
            setTransactions(res.data);
        } catch(error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-4xl space-y-6">
            {/* The control bar at the top*/}
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                <div>
                    <UserButton />
                    <div>
                        <h2 className="text-lg font-semibold">Bank Connections</h2>
                        <p className="text-sm text-gray-500">Manage your linked accounts</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <LinkAccountButton />
                    <Button onClick={fetchTransactions} variant="outline" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading ? "Syncing..." : "Sync Transactions"}
                    </Button>
                </div>
            </div>

            <AIInsights />

            {/* The spending chart */}
            <SpendingChart transactions={transactions} />

            {/* The List of Details */}
            <TransactionList transactions={transactions} />
        </div>
    );
}