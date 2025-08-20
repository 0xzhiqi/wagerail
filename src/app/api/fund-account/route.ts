import { VM_RPC } from '@/config/rpc';
import { NextRequest, NextResponse } from 'next/server';


export async function POST(request: NextRequest) {
    try {
        const { address, amount = 10 } = await request.json();

        if (!address) {
            return NextResponse.json({ error: 'Address required' }, { status: 400 });
        }

        // Convert amount to hex (amount in AVAX)
        const amountInWei = (amount * 1e18).toString(16);
        const hexAmount = '0x' + amountInWei;

        // Fund with AVAX using anvil_setBalance
        const response = await fetch(VM_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'anvil_setBalance',
                params: [address, hexAmount],
                id: 1,
            }),
        });

        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error.message);
        }

        return NextResponse.json({ 
            success: true, 
            message: `Funded ${address} with ${amount} AVAX`,
            amount: amount,
            currency: 'AVAX'
        });
    } catch (error) {
        console.error('AVAX funding error:', error);
        return NextResponse.json({ error: 'Failed to fund account with AVAX' }, { status: 500 });
    }
}