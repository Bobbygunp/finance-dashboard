"use client";

import { useState } from "react";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

export default function AIInsights() {
    const [insight, setInsight] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const generateInsight = async () => {
        setLoading(true);
        try {
            const response = await axios.post("/api/insights");
            setInsight(response.data.insight);
        } catch(error) {
            console.error("Error generating insight:", error);
            setInsight("Failed to generate insights. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-4xl mt-6 border-blue-100 bg-blue-50/30">
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-blue-900">AI Financial Insights</CardTitle>
                </div>
                <Button
                    onClick={generateInsight}
                    disabled={loading}
                    variant="outline"
                    className="border-blue-200 hover:bg-blue-100 text-blue-700"
                >
                    {
                        loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            "Generate Insight"
                        )
                    }
                </Button>
            </CardHeader>
            <CardContent>
                {
                    insight ? (
                        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line">
                            {insight}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic">
                            Click "Generate Insight" to let AI analyze your recent spending patterns.
                        </p>
                    )
                }
            </CardContent>
        </Card>
    );
}