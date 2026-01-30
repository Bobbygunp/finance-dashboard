'use server';

export async function getForecast(last5Days: number[]) {
    try {
        const res = await fetch('http://127.0.0.1:8000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recent_spending: last5Days }),
            cache: 'no-store',
        });

        if(!res.ok) throw new Error('Failed to fetch from AI backend');

        const data = await res.json();
        return data;
    } catch(error) {
        console.error(error);
        return { error: "AI Service Unavailable" };
    }
}