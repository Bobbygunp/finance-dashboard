import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";
import { auth } from "@clerk/nextjs/server";

export async function POST() {
    try {
        // const clientUserId = "test_user_123";
        const { userId } = await auth();

        if(!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const tokenResponse = await plaidClient.linkTokenCreate({
            user: { client_user_id: userId },
            client_name: "FinanceFlow",
            products: [Products.Transactions],
            country_codes: [CountryCode.Us],
            language: "en",
        });

        return NextResponse.json({ link_token: tokenResponse.data.link_token })
    } catch(error) {
        console.error("An Error while creating link token:", error);
        return NextResponse.json(
            {error: "Failed to create link token"},
            {status: 500}
        );
    }
}