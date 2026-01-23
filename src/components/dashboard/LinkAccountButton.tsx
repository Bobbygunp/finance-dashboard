"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import axios from "axios";

export default function LinkAccountButton() {
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const createLinkToken = async () => {
            try {
                const response = await axios.post("/api/plaid/create-link-token");
                setToken(response.data.link_token);
            } catch(error) {
                console.error("Error while fetching the link token:", error);
            }
        };
        createLinkToken();
    }, []);

    const onSuccess = useCallback(async (public_token: string, metadata: any) => {
        console.log("SUCCESS! Public Token:", public_token);
        console.log("Account Metadata:", metadata);
        // TODO: Send this public_token to your backend to exchange it for an access_token
        // await axios.post("/api/plaid/exchange-token", { public_token })
    }, []);

    const { open, ready } = usePlaidLink({
        token,
        onSuccess,
    });

    return (
        <Button
            onClick={() => open()}
            disabled={!ready}
            className="bg-blue-600 hover:bg-blue-700 text-white"
        >
            Connect Bank Account
        </Button>
    );
}