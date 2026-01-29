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
            return NextResponse.json({ 
                insight: {
                    summary: "No transactions found to analyze.",
                    savings: "Start spending to see insights!",
                    positive: "You have no debt!"
                }
            });
        }

        const transactionSummary = transactions.map(t => 
            `${t.name}: $${t.amount} (${t.date.toISOString().split('T')[0]})`
        ).join("\n");

        const prompt = `
            You are a friendly financial advisor. 
            Analyze the following recent financial transactions:
            ${transactionSummary}

            Return a JSON object with exactly three keys:
            1. "summary": A brief summary of spending habits (max 2 sentences).
            2. "savings": One specific area to save money (max 2 sentences).
            3. "positive": A positive reinforcement or compliment (max 2 sentences).
            
            Do not use markdown. Just plain text strings for the values.
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt}],
            model: "gpt-5-mini",
            response_format: {type: "json_object" },
        });

        // const insight = completion.choices[0].message.content;
        const insightContent = completion.choices[0].message.content;
        const insightData = insightContent ? JSON.parse(insightContent) : null;

        return NextResponse.json({ insight: insightData });

        // return NextResponse.json({ insight });
    } catch(error) {
        console.error("AI Error:", error);
        return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
    }
}