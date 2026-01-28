"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SpendingChartProps {
    transactions: any[];
}

export default function SpendingChart({ transactions }: SpendingChartProps) {
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
        <Card className="w-full h-[300px]">
            <CardHeader>
                <CardTitle>Daily Spending</CardTitle>
            </CardHeader>
            <CardContent className="h-[220px]">
                {chartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        No spending data available
                    </div>
                ) : (
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
                )}
            </CardContent>
        </Card>
    )
}