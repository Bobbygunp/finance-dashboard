import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { db } from "@/lib/db";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { public_token } = body;

        const response = await plaidClient.itemPublicTokenExchange({
            public_token
        });

        const accessToken = response.data.access_token;
        const itemId = response.data.item_id;

        const userId = "test_user_123";

        await db.user.upsert({
            where: { id: userId },
            update: {},
            create: {
                id: userId,
                email: "demo@example.com",
                clerkUserId: "demo_clerk_user_id",
                firstName: "Demo",
                lastName: "User"
            }
        });

        await db.account.create({
            data: {
                user
            }
        })
    }
}