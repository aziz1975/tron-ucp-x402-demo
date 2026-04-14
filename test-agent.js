require('dotenv').config();

const MERCHANT_BASE_URL = process.env.SERVER_URL || 'http://localhost:8000';
const RESOURCE_PATH = '/api/premium-data';
const AGENT_ID = `agent-${Math.random().toString(36).substring(2, 10)}`;

async function runMockAgent() {
    console.log(`\n[AGENT ${AGENT_ID}] Booting x402-capable autonomous client...\n`);

    try {
        const {
            X402Client,
            X402FetchClient,
            ExactPermitTronClientMechanism,
            ExactGasFreeClientMechanism,
            TronClientSigner,
            SufficientBalancePolicy,
            GasFreeAPIClient,
            getGasFreeApiBaseUrl,
            findByAddress,
            decodePaymentPayload
        } = await import('@bankofai/x402');

        if (!process.env.TRON_PRIVATE_KEY) {
            throw new Error('TRON_PRIVATE_KEY is required for the x402 demo agent.');
        }

        const tronSigner = await TronClientSigner.create();
        const x402Client = new X402Client();
        const gasfreeClients = {
            'tron:nile': new GasFreeAPIClient(process.env.GASFREE_API_BASE_URL_NILE || getGasFreeApiBaseUrl('tron:nile')),
            'tron:shasta': new GasFreeAPIClient(process.env.GASFREE_API_BASE_URL_SHASTA || getGasFreeApiBaseUrl('tron:shasta')),
            'tron:mainnet': new GasFreeAPIClient(process.env.GASFREE_API_BASE_URL_MAINNET || getGasFreeApiBaseUrl('tron:mainnet'))
        };

        x402Client.register('tron:*', new ExactPermitTronClientMechanism(tronSigner));
        x402Client.register('tron:*', new ExactGasFreeClientMechanism(tronSigner, gasfreeClients));
        x402Client.registerPolicy(SufficientBalancePolicy);
        x402Client.registerPolicy({
            apply(requirements) {
                for (let i = 0; i < requirements.length; i += 1) {
                    const requirement = requirements[i];
                    const tokenInfo = findByAddress(requirement.network, requirement.asset);
                    if (requirement.scheme === 'exact_gasfree' && tokenInfo && tokenInfo.symbol === 'USDT') {
                        console.log(`[AGENT] Policy selected ${requirement.scheme} on ${requirement.network} (${tokenInfo.symbol}).`);
                        return [requirement];
                    }
                }
                return requirements;
            }
        });

        const client = new X402FetchClient(x402Client);
        const resourceUrl = `${MERCHANT_BASE_URL}${RESOURCE_PATH}`;

        console.log(`[AGENT] Wallet address: ${tronSigner.getAddress()}`);
        console.log(`[AGENT] Requesting protected resource: GET ${resourceUrl}`);

        const res = await client.get(resourceUrl);
        const paymentResponseHeader = res.headers.get('payment-response');

        console.log(`[AGENT] Resource response: HTTP ${res.status} ${res.statusText}`);

        if (paymentResponseHeader) {
            const settlement = decodePaymentPayload(paymentResponseHeader);
            console.log('[AGENT] x402 settlement completed.');
            console.log(`         Network: ${settlement.network}`);
            console.log(`         TX Hash: ${settlement.transaction}`);
        }

        const body = await res.json();

        if (!res.ok) {
            throw new Error(JSON.stringify(body));
        }

        console.log('[AGENT] SUCCESS! Premium payload received:');
        console.log(JSON.stringify(body.data, null, 2));
        console.log(`\n[AGENT ${AGENT_ID}] Flow completed successfully. Terminating VM.\n`);
    } catch (error) {
        console.error('[AGENT] Execution Error:', error.message || error);
    }
}

runMockAgent();
