"use client";

import { useState } from "react";
import { getForecast } from "@/app/actions";

export default function AIPrediction() {
    const [loading, setLoading] = useState(false);
    const [prediction, setPrediction] = useState<string | null>(null)

    const recentSpending = [45.50, 12.00, 100.00, 5.50, 60.00];

    const handlePredict = async () => {
        setLoading(true);
        const result = await getForecast(recentSpending);
        setLoading(false);

        if(result.predicted_next_day_spend) {
            setPrediction(`$${result.predicted_next_day_spend}`)
        }
    };

    return (
        <div className="p-10 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">AI Financial Analysis</h1>

            <div className="bg-gray-100 p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Spending Forecast</h2>
                <p className="mb-4 text-gray-700">
                    Recent activity: {recentSpending.map(n => `$${n}`).join(', ')}
                </p>

                {prediction && (
                    <div className="bg-green-100 text-green-800 p-4 rounded mb-4">
                        Predicted spending for tomorrow: <strong>{prediction}</strong>
                    </div>
                )}

                <button
                    onClick={handlePredict}
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                    {loading ? "Analyzing...": "Generate AI Forecast"}
                </button>
            </div>
        </div>
    );
}