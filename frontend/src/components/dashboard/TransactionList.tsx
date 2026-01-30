"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface TransactionListProps {
    transactions: any[];
}

export default function TransactionList({ transactions }: TransactionListProps) {
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
                {transactions.length === 0 ? (
                    <p className="text-gray-500 text-sm">No transactions to display.</p>
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