"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function TransactionList() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await axios.get("/api/plaid/transactions");
            setTransactions(res.data);
        } catch(error) {
            console.error("Error while fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-2xl mt-8">
            <CardHeader className="flex flex-row items-center justify-between">
                <button
                    onClick={fetchTransactions}
                    className="text-sm bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
                >
                    {loading ? "Syncing..." : "Sync Transactions"}
                </button>
            </CardHeader>
            <CardContent>
                {transactions.length === 0 ? (
                    <p className="text-gray-500 text-sm">No transactions found. Click Sync.</p>
                ) : (
                    <div className="space-y-4">
                        {transactions.map((t) => (
                            <div key={t.id} className="flex justify-between items-center border-b pb-2">
                                <div>
                                    <p className="font-medium">{t.name}</p>
                                    <p className="text-xs text-gray-500">{new Date(t.date).toLocaleDateString()}</p>
                                </div>
                                <div className={`font-bold ${t.amount > 0 ? "text-red-500" : "text-green-500"}`}>
                                    ${Math.abs(t.amount).toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}