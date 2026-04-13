require('dotenv').config();
const { TronWeb } = require('tronweb');
const axios = require('axios');

const MERCHANT_BASE_URL = 'http://localhost:8000';
const UCP_VERSION = '2026-01-23';
const SHOPPING_SERVICE = 'dev.ucp.shopping';
const CHECKOUT_CAPABILITY = 'dev.ucp.shopping.checkout';
const TRON_HANDLER_ID = 'localhost.tron.trc20_usdt';
const AGENT_ID = `agent-${Math.random().toString(36).substring(2, 10)}`;
const TRC20_USDT_CONTRACT = process.env.TRC20_USDT_CONTRACT || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
const MOCK_PLATFORM_PROFILE_URL = `${MERCHANT_BASE_URL}/public/mock-platform-profile.json`;

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: process.env.TRON_PRIVATE_KEY
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getUcpAgentHeaders = () => ({
    'UCP-Agent': `profile="${MOCK_PLATFORM_PROFILE_URL}"`,
    'Content-Type': 'application/json'
});

const getCheckoutServiceEndpoint = (manifest) => {
    const services = manifest.ucp && manifest.ucp.services && manifest.ucp.services[SHOPPING_SERVICE];
    if (!services || !services.length) return null;
    return services[0].endpoint;
};

const getSelectedPaymentInstrument = (checkoutSession) => {
    const payment = checkoutSession.payment || {};
    const instruments = payment.instruments || [];
    for (let i = 0; i < instruments.length; i += 1) {
        if (instruments[i] && instruments[i].selected) return instruments[i];
    }
    return instruments[0] || null;
};

async function runMockAgent() {
    console.log(`\n[AGENT ${AGENT_ID}] Booting up autonomous VM...\n`);

    try {
        console.log('[AGENT] Attempting to fetch premium AI API data at GET /api/premium-data...');

        let ucpManifestUrl = null;
        try {
            await axios.get(`${MERCHANT_BASE_URL}/api/premium-data`, {
                headers: getUcpAgentHeaders()
            });
        } catch (error) {
            if (error.response && error.response.status === 402) {
                console.log('[AGENT] Received HTTP 402 Payment Required.');
                console.log('[AGENT] Extracting the UCP business profile URL from WWW-Authenticate...');

                const wwwAuth = error.response.headers['www-authenticate'];
                if (wwwAuth && wwwAuth.indexOf('UCP url=') !== -1) {
                    ucpManifestUrl = wwwAuth.split('url="')[1].split('"')[0];
                    console.log(`[AGENT] Discovered UCP business profile URL: ${ucpManifestUrl}\n`);
                } else {
                    ucpManifestUrl = error.response.data.ucp_profile;
                }
            } else {
                console.error('[AGENT] Unexpected Error:', error.message);
                return;
            }
        }

        if (!ucpManifestUrl) {
            console.error('[AGENT] Could not discover the UCP business profile. Aborting payment.');
            return;
        }

        console.log('[AGENT] Fetching the UCP business profile...');
        const manifestRes = await axios.get(ucpManifestUrl, {
            headers: getUcpAgentHeaders()
        });
        const manifest = manifestRes.data;
        const capabilityList = manifest.ucp && manifest.ucp.capabilities && manifest.ucp.capabilities[CHECKOUT_CAPABILITY];
        if (!capabilityList || !capabilityList.length) {
            console.log('[AGENT] Merchant does not advertise the official checkout capability. Aborting.');
            return;
        }

        const checkoutServiceEndpoint = getCheckoutServiceEndpoint(manifest);
        if (!checkoutServiceEndpoint) {
            console.log('[AGENT] Merchant business profile is missing a checkout service endpoint. Aborting.');
            return;
        }

        console.log(`[AGENT] Business profile version ${UCP_VERSION} parsed.`);
        console.log(`[AGENT] Checkout service endpoint: ${checkoutServiceEndpoint}\n`);

        const checkoutSessionsUrl = `${checkoutServiceEndpoint}/checkout-sessions`;
        console.log('[AGENT] Creating a checkout session for premium data access...');

        const createRes = await axios.post(checkoutSessionsUrl, {
            buyer: {
                id: AGENT_ID,
                type: 'autonomous_agent'
            },
            line_items: [{
                item: { id: 'premium_data_access' },
                quantity: 1
            }]
        }, {
            headers: getUcpAgentHeaders()
        });

        let checkoutSession = createRes.data;
        console.log(`[AGENT] Checkout session created: ${checkoutSession.id}`);

        while (checkoutSession.status === 'incomplete') {
            const paymentInstrument = getSelectedPaymentInstrument(checkoutSession);
            const display = paymentInstrument ? paymentInstrument.display || {} : {};
            const transferState = display.transfer_state;

            if (transferState === 'ready_for_transfer') {
                console.log('\n[AGENT] Human approval completed. Transfer instructions are now ready.\n');
                break;
            }

            if (transferState === 'rejected' || checkoutSession.status === 'canceled') {
                console.log('[AGENT] Checkout session was rejected or canceled. Stopping.');
                return;
            }

            console.log(`[AGENT] Checkout session state: ${transferState || checkoutSession.status}. Polling for updates...`);
            await sleep(2000);
            const pollRes = await axios.get(`${checkoutSessionsUrl}/${checkoutSession.id}`, {
                headers: getUcpAgentHeaders()
            });
            checkoutSession = pollRes.data;
        }

        const paymentInstrument = getSelectedPaymentInstrument(checkoutSession);
        if (!paymentInstrument) {
            console.error('[AGENT] No payment instrument was available on the checkout session.');
            return;
        }

        const transferDisplay = paymentInstrument.display || {};
        const destinationAddress = transferDisplay.receiver_address;
        const amountBaseUnits = parseInt(transferDisplay.amount, 10);
        const contractAddress = transferDisplay.contract_address || TRC20_USDT_CONTRACT;

        console.log('[AGENT] Received official checkout session payment instructions.');
        console.log(`    Checkout Session: ${checkoutSession.id}`);
        console.log(`    Handler:          ${paymentInstrument.handler_id || TRON_HANDLER_ID}`);
        console.log(`    Pay To:           ${destinationAddress}`);
        console.log(`    Amount:           ${transferDisplay.amount_decimal} USDT (${amountBaseUnits} base units)\n`);

        const parameters = [
            { type: 'address', value: destinationAddress },
            { type: 'uint256', value: amountBaseUnits }
        ];

        console.log('[AGENT] Building the TRC20 transfer payload...');
        const ownerAddress = tronWeb.defaultAddress.base58;
        const transaction = await tronWeb.transactionBuilder.triggerSmartContract(
            contractAddress,
            'transfer(address,uint256)',
            {},
            parameters,
            ownerAddress
        );

        console.log('[AGENT] Signing the raw TRON transaction...');
        const signedTx = await tronWeb.trx.sign(transaction.transaction);

        console.log('[AGENT] Broadcasting the payment to TRON Nile...\n');
        await tronWeb.trx.sendRawTransaction(signedTx);
        const txHash = signedTx.txID;
        console.log(`[AGENT] Broadcast successful. Transaction Hash: ${txHash}`);
        console.log('[AGENT] Waiting 10 seconds for block propagation...\n');
        await sleep(10000);

        console.log('[AGENT] Completing the checkout session with the blockchain receipt...');
        const completeRes = await axios.post(`${checkoutSessionsUrl}/${checkoutSession.id}/complete`, {
            payment: {
                instruments: [{
                    id: paymentInstrument.id,
                    selected: true,
                    handler_id: paymentInstrument.handler_id || TRON_HANDLER_ID,
                    credential: {
                        type: 'blockchain_receipt',
                        transaction_hash: txHash
                    }
                }]
            }
        }, {
            headers: getUcpAgentHeaders()
        });

        checkoutSession = completeRes.data;
        console.log(`[AGENT] Checkout completion status: ${checkoutSession.status}\n`);

        console.log('[AGENT] Exchanging the verified receipt for the premium API payload...');
        const premiumRes = await axios.get(`${MERCHANT_BASE_URL}/api/premium-data`, {
            headers: Object.assign({}, getUcpAgentHeaders(), {
                Authorization: `UCP ${txHash}`
            })
        });

        console.log('[AGENT] SUCCESS! HTTP 200 OK.');
        console.log('[AGENT] Payload Data Received:');
        console.log(JSON.stringify(premiumRes.data.data, null, 2));
        console.log(`\n[AGENT ${AGENT_ID}] Flow completed successfully. Terminating VM.\n`);
    } catch (error) {
        if (error.response) {
            console.error(`[AGENT] Execution Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else {
            console.error('[AGENT] Execution Error:', error.message);
        }
    }
}

runMockAgent();
