"use client";

import { useState } from "react";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, TrendingDown, TrendingUp, Wallet } from "lucide-react";

// Define the shape of our new JSON data
interface InsightData {
  summary: string;
  savings: string;
  positive: string;
}

export default function AIInsights() {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(false);

  const generateInsight = async () => {
    setLoading(true);
    try {
      const response = await axios.post("/api/insights");
      setData(response.data.insight);
    } catch (error) {
      console.error("Error generating insight:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full mt-6 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">AI Financial Analysis</CardTitle>
        </div>
        <Button 
            onClick={generateInsight} 
            disabled={loading}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white"
        >
            {loading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                </>
            ) : (
                "Refresh Insights"
            )}
        </Button>
      </CardHeader>
      
      <CardContent className="pt-6 grid gap-4 md:grid-cols-3">
        {!data ? (
           <div className="col-span-3 text-center py-8 text-gray-500">
             <p>Click "Refresh Insights" to let AI analyze your spending patterns.</p>
           </div>
        ) : (
          <>
            {/* 1. Summary Card */}
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-blue-700 font-semibold">
                    <Wallet className="h-4 w-4" />
                    <h3>Spending Summary</h3>
                </div>
                <p className="text-sm text-blue-900 leading-relaxed">
                    {data.summary}
                </p>
            </div>

            {/* 2. Savings Card */}
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-amber-700 font-semibold">
                    <TrendingDown className="h-4 w-4" />
                    <h3>Savings Opportunity</h3>
                </div>
                <p className="text-sm text-amber-900 leading-relaxed">
                    {data.savings}
                </p>
            </div>

            {/* 3. Positive Card */}
            <div className="p-4 bg-green-50 border border-green-100 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-green-700 font-semibold">
                    <TrendingUp className="h-4 w-4" />
                    <h3>Win of the Month</h3>
                </div>
                <p className="text-sm text-green-900 leading-relaxed">
                    {data.positive}
                </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}