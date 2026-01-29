import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { db } from "@/lib/db";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { public_token } = body;

        const response = await plaidClient.itemPublicTokenExchange({
            public_token
        });

        const accessToken = response.data.access_token;
        const itemId = response.data.item_id;

        const { userId } = await auth();
        const user = await currentUser();

        if(!userId || !user) {
            return NextResponse.json({ error: "Unauthorized" }, {status: 401});
        }

        await db.user.upsert({
            where: { id: userId },
            update: {},
            create: {
                id: userId,
                email: user.emailAddresses[0]?.emailAddress || "no-email@example.com",
                clerkUserId: userId,
                firstName: user.firstName,
                lastName: user.lastName
            }
        });

        await db.account.create({
            data: {
                userId: userId,
                plaidAccountId: itemId,
                plaidAccessToken: accessToken,
                name: "Plaid Connected Bank",
                type: "depository",
                currentBalance: 0
            }
        });

        console.log("Success! The Access Token saved to the database.");

        return NextResponse.json({ success: true});
    } catch(error) {
        console.error("Exchange Error:", error);
        return NextResponse.json({error: "Failed to exchange token"}, {status: 500});
    }
}