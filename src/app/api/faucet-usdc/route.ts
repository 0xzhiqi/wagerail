import { NextRequest, NextResponse } from 'next/server';

const VM_RPC = 'http://34.170.7.126:8545';
const USDC_CONTRACT = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E';
const USDC_WHALE = '0x9f8c163cBA728e99993ABe7495F06c0A3c8Ac8b9';

async function rpcCall(method: string, params: any[]) {
    const response = await fetch(VM_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method,
            params,
            id: 1,
        }),
    });
    
    const result = await response.json();
    if (result.error) {
        throw new Error(result.error.message);
    }
    return result.result;
}

export async function POST(request: NextRequest) {
    try {
        const { address, amount = 100 } = await request.json();

        if (!address) {
            return NextResponse.json({ error: 'Address required' }, { status: 400 });
        }

        if (amount > 1000) {
            return NextResponse.json({ error: 'Maximum 1000 USDC per request' }, { status: 400 });
        }

        // Convert amount to USDC wei (6 decimals)
        const amountInWei = BigInt(amount * 1e6);
        const hexAmount = '0x' + amountInWei.toString(16);

        // Prepare transfer function call data
        // transfer(address to, uint256 amount)
        const functionSelector = '0xa9059cbb';
        const paddedAddress = address.slice(2).padStart(64, '0');
        const paddedAmount = amountInWei.toString(16).padStart(64, '0');
        const callData = functionSelector + paddedAddress + paddedAmount;

        // Step 1: Impersonate the whale account
        await rpcCall('anvil_impersonateAccount', [USDC_WHALE]);

        // Step 2: Send the transaction
        const txHash = await rpcCall('eth_sendTransaction', [{
            from: USDC_WHALE,
            to: USDC_CONTRACT,
            data: callData,
            gas: '0x15f90', // 90000 gas
        }]);

        // Step 3: Stop impersonating
        await rpcCall('anvil_stopImpersonatingAccount', [USDC_WHALE]);

        return NextResponse.json({ 
            success: true, 
            message: `Sent ${amount} USDC to ${address}`,
            txHash: txHash,
            amount: amount,
            currency: 'USDC'
        });
    } catch (error) {
        console.error('USDC faucet error:', error);
        
        // Make sure to stop impersonating even if there's an error
        try {
            await rpcCall('anvil_stopImpersonatingAccount', [USDC_WHALE]);
        } catch (cleanupError) {
            console.error('Failed to stop impersonating:', cleanupError);
        }
        
        return NextResponse.json({ 
            success: false,
            error: 'Failed to send USDC',
            message: 'Failed to send USDC',
            amount: 0,
            currency: 'USDC'
        }, { status: 500 });
    }
}