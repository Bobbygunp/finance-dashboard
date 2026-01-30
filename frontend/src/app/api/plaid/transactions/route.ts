import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server"


export async function GET() {
    try {
        // const userId = "test_user_123";
        const { userId } = await auth();

        if(!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401})
        }

        const account = await db.account.findFirst({
            where: { userId: userId },
        });

        if(!account || !account.plaidAccessToken) {
            return NextResponse.json({error: "No bank account found"}, {status: 400});
        }

        const response = await plaidClient.transactionsSync({
            access_token: account.plaidAccessToken,
        });

        const plaidTransactions = response.data.added;

        for(const t of plaidTransactions) {
            if(t.amount > 0) {
                await db.transaction.upsert({
                    where: { plaidTransactionId: t.transaction_id },
                    update: {},
                    create: {
                        id: crypto.randomUUID(),
                        accountId: account.id,
                        userId: userId,
                        plaidTransactionId: t.transaction_id,
                        amount: t.amount,
                        date: new Date(t.date),
                        name: t.name,
                        category: t.category ? t.category[0] : "Uncategorized",
                        status: "POSTED"
                    }
                });
            }
        }

        const savedTransactions = await db.transaction.findMany({
            where: { userId: userId },
            orderBy: { date: "desc" }
        });
        
        return NextResponse.json(savedTransactions)
    } catch(error) {
        console.error("Error while fetching transactions:", error);
        return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
    }
}