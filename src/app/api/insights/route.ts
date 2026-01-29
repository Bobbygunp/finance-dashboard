import { NextResponse } from  "next/server";
import { db } from  "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST() {
    try {
        const { userId } = await auth();
        if(!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const transactions = await db.transaction.findMany({
            where: { userId },
            orderBy: { date: "desc" },
            take: 30,
        });

        if(transactions.length === 0) {
            return NextResponse.json({ insight: "No transactions found to analyze."});
        }

        const transactionSummary = transactions.map(t => 
            `${t.name}: ${t.amount} (${t.date.toISOString().split('T')[0]})`
        ).join("\n");

        const prompt = `
            You are a friendly financial advisor.
            Analyze the following recent financial transactions:

            ${transactionSummary}

            Please Provide:
            1. A brief summary of spending habits.
            2. One specific area where I could save money.
            3. A positive reinforcement about a good financial choice (or general encouragement).

            Keep the tone helpful and concise (under 150 words).
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt}],
            model: "gpt-4o",
        });

        const insight = completion.choices[0].message.content;

        return NextResponse.json({ insight });
    } catch(error) {
        console.error("AI Error:", error);
        return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
    }
}