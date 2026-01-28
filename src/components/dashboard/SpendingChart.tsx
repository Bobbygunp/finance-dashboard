"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car } from "lucide-react";

export default function SpendingChart({ transactions }: {transactions: any[]}) {
    const chartData = transactions.reduce((acc: any[], t) => {
        const date = new Date(t.date).toLocaleDateString();
        const existing = acc.find((item) => item.date === date);

        if(existing) {
            existing.amount += t.amount;
        } else {
            acc.push({ date, amount: t.amount });
        }
        return acc;
    }, []).reverse();

    return (
        <Card className="w-full max-w-2xl mt-8">
            <CardHeader>
                <CardTitle>Spending Over Time</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <XAxis 
                                dataKey="date"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis 
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `$${value}`}
                            />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '8px' }}
                            />
                            <Bar
                                dataKey="amount"
                                fill="#25EBD1" //#2563eb Blue color
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}