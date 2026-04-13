require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { TronWeb } = require('tronweb');
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const UCP_VERSION = '2026-01-23';
const SHOPPING_SERVICE = 'dev.ucp.shopping';
const CHECKOUT_CAPABILITY = 'dev.ucp.shopping.checkout';
const TRON_HANDLER_ID = 'localhost.tron.trc20_usdt';
const TRON_HANDLER_VERSION = '1.0.0';
const TRC20_TRANSFER_SELECTOR = 'a9059cbb';
const MERCHANT_ADDRESS = process.env.MERCHANT_ADDRESS || 'TQGfKPHs3AwiBT44ibkCU64u1G4ttojUXU';
const TRC20_USDT_CONTRACT = process.env.TRC20_USDT_CONTRACT || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
const TOKEN_DECIMALS = 6;
const TOKEN_MULTIPLIER = 1000000;
const CATALOG = {
    premium_data_access: {
        title: 'Premium AI Data Access',
        unitAmount: 15 * TOKEN_MULTIPLIER,
        currency: 'USDT'
    }
};

const tronWeb = new TronWeb({
    fullNode: 'https://nile.trongrid.io',
    solidityNode: 'https://nile.trongrid.io',
    eventServer: 'https://nile.trongrid.io',
});

const getBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;
const getServiceBaseUrl = (req) => `${getBaseUrl(req)}/ucp/v1`;
const formatBaseUnits = (amount) => (Number(amount) / TOKEN_MULTIPLIER).toFixed(TOKEN_DECIMALS);

const normalizeAddress = (address) => {
    if (!address) return null;
    if (/^41[0-9a-fA-F]{40}$/.test(address)) {
        return tronWeb.address.fromHex(address);
    }
    return address;
};

const decodeTrc20TransferData = (data) => {
    if (!data || typeof data !== 'string') return null;

    const normalizedData = data.replace(/^0x/, '');
    if (!normalizedData.startsWith(TRC20_TRANSFER_SELECTOR)) return null;
    if (normalizedData.length < 136) return null;

    const encodedRecipient = normalizedData.slice(8, 72);
    const encodedAmount = normalizedData.slice(72, 136);
    const recipientHex = `41${encodedRecipient.slice(-40)}`.toLowerCase();

    return {
        recipient: tronWeb.address.fromHex(recipientHex),
        amount: BigInt(`0x${encodedAmount}`).toString(),
    };
};

const createCheckoutSessionId = () => `chk_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
const createPaymentInstrumentId = (sessionId) => `pi_${sessionId}`;
const createMerchantOrderId = (sessionId) => `ord_${sessionId}`;

const normalizeRequestedLineItems = (body) => {
    const requestedLineItems = body.line_items || [];
    const legacyItems = body.items || [];
    let normalizedRequests = requestedLineItems;

    if (!normalizedRequests.length && legacyItems.length) {
        normalizedRequests = legacyItems.map((item) => ({
            item: { id: item.id },
            quantity: item.quantity || 1
        }));
    }

    if (!normalizedRequests.length) {
        normalizedRequests = [{ item: { id: 'premium_data_access' }, quantity: 1 }];
    }

    const lineItems = [];
    let totalBaseUnits = 0;

    normalizedRequests.forEach((lineItem, index) => {
        const itemId = lineItem.item && lineItem.item.id ? lineItem.item.id : lineItem.id;
        const quantity = Number(lineItem.quantity || 1);
        const catalogItem = CATALOG[itemId];

        if (!catalogItem || !Number.isFinite(quantity) || quantity <= 0) {
            throw new Error(`Unsupported line item: ${itemId || 'unknown'}`);
        }

        const lineAmount = catalogItem.unitAmount * quantity;
        totalBaseUnits += lineAmount;

        lineItems.push({
            id: `li_${index + 1}`,
            item: {
                id: itemId,
                title: catalogItem.title,
                price: catalogItem.unitAmount,
                currency: catalogItem.currency
            },
            quantity,
            totals: [
                { type: 'subtotal', amount: lineAmount, currency: catalogItem.currency },
                { type: 'total', amount: lineAmount, currency: catalogItem.currency }
            ]
        });
    });

    return {
        currency: 'USDT',
        lineItems,
        totalBaseUnits,
        totals: [
            { type: 'subtotal', amount: totalBaseUnits, currency: 'USDT' },
            { type: 'total', amount: totalBaseUnits, currency: 'USDT' }
        ]
    };
};

const getTransferState = (order) => {
    if (order.status === 'AWAITING_2FA') return 'awaiting_human_approval';
    if (order.status === 'PENDING') return 'ready_for_transfer';
    if (order.status === 'VERIFYING') return 'verifying_blockchain_receipt';
    if (order.status === 'PAID') return 'completed';
    if (order.status === 'FAILED') return 'receipt_rejected';
    if (order.status === 'REJECTED') return 'rejected';
    if (order.status === 'CANCELED') return 'canceled';
    return 'unknown';
};

const getCheckoutStatus = (order) => {
    if (order.status === 'PAID') return 'completed';
    if (order.status === 'REJECTED' || order.status === 'CANCELED') return 'canceled';
    return 'incomplete';
};

const buildCheckoutMessages = (order) => {
    if (order.status === 'AWAITING_2FA') {
        return [{
            code: 'human_approval_required',
            severity: 'info',
            content: 'Checkout is waiting for merchant approval before the payment transfer instructions can be used.'
        }];
    }

    if (order.status === 'PENDING') {
        return [{
            code: 'payment_ready',
            severity: 'info',
            content: 'Human approval completed. The TRON transfer can now be signed and broadcast.'
        }];
    }

    if (order.status === 'VERIFYING') {
        return [{
            code: 'verifying_blockchain_receipt',
            severity: 'info',
            content: 'The blockchain receipt has been submitted and is being verified against TRON Nile.'
        }];
    }

    if (order.status === 'FAILED') {
        return [{
            code: 'payment_verification_failed',
            severity: 'recoverable',
            content: 'The submitted blockchain receipt did not satisfy the checkout requirements.'
        }];
    }

    if (order.status === 'REJECTED') {
        return [{
            code: 'merchant_rejected_checkout',
            severity: 'fatal',
            content: 'The merchant rejected this checkout during human approval.'
        }];
    }

    if (order.status === 'CANCELED') {
        return [{
            code: 'checkout_canceled',
            severity: 'fatal',
            content: 'The checkout session was canceled.'
        }];
    }

    return [];
};

const buildUcpMetadata = (req, order) => {
    const baseUrl = getBaseUrl(req);
    const handlerConfig = {
        network: 'TRON_NILE',
        asset: 'TRC20_USDT',
        contract_address: TRC20_USDT_CONTRACT,
        receiver_address: MERCHANT_ADDRESS
    };

    if (order) {
        handlerConfig.transfer_state = getTransferState(order);
        handlerConfig.amount = String(order.amount_in_base_units);
        handlerConfig.amount_decimal = formatBaseUnits(order.amount_in_base_units);
        handlerConfig.checkout_session_id = order.id;
    } else {
        handlerConfig.transfer_state = 'profile_discovery';
    }

    return {
        version: UCP_VERSION,
        capabilities: {
            [CHECKOUT_CAPABILITY]: [{
                version: UCP_VERSION,
                spec: 'https://ucp.dev/latest/specification/checkout/',
                schema: 'https://ucp.dev/2026-01-23/schemas/shopping/checkout.json'
            }]
        },
        payment_handlers: {
            [TRON_HANDLER_ID]: [{
                version: TRON_HANDLER_VERSION,
                spec: `${baseUrl}/public/tron-nile-trc20-usdt-handler.json`,
                schema: `${baseUrl}/public/tron-nile-trc20-usdt-handler.schema.json`,
                config: handlerConfig
            }]
        }
    };
};

const buildBusinessProfile = (req) => {
    const serviceBaseUrl = getServiceBaseUrl(req);
    return {
        name: 'TRON UCP Demo Merchant',
        description: 'A TRON Nile UCP checkout demo aligned to the official UCP checkout session REST shape.',
        url: getBaseUrl(req),
        ucp: {
            version: UCP_VERSION,
            services: {
                [SHOPPING_SERVICE]: [{
                    version: UCP_VERSION,
                    endpoint: serviceBaseUrl,
                    spec: 'https://ucp.dev/latest/specification/checkout-rest/'
                }]
            },
            capabilities: {
                [CHECKOUT_CAPABILITY]: [{
                    version: UCP_VERSION,
                    spec: 'https://ucp.dev/latest/specification/checkout/',
                    schema: 'https://ucp.dev/2026-01-23/schemas/shopping/checkout.json'
                }]
            },
            payment_handlers: buildUcpMetadata(req).payment_handlers
        }
    };
};

const buildCheckoutLinks = (req, order) => {
    const sessionUrl = `${getServiceBaseUrl(req)}/checkout-sessions/${order.id}`;
    return {
        self: sessionUrl,
        complete: `${sessionUrl}/complete`,
        cancel: `${sessionUrl}/cancel`
    };
};

const buildCheckoutSessionResponse = (req, order) => {
    const paymentInstrument = {
        id: order.payment_instrument_id,
        type: 'blockchain_transfer',
        handler_id: TRON_HANDLER_ID,
        selected: true,
        display: {
            title: 'TRON Nile TRC20 USDT transfer',
            network: 'TRON_NILE',
            asset: 'TRC20_USDT',
            contract_address: TRC20_USDT_CONTRACT,
            receiver_address: MERCHANT_ADDRESS,
            amount: String(order.amount_in_base_units),
            amount_decimal: formatBaseUnits(order.amount_in_base_units),
            transfer_state: getTransferState(order)
        }
    };

    if (order.txHash) {
        paymentInstrument.receipt = {
            transaction_hash: order.txHash
        };
    }

    const response = {
        id: order.id,
        status: getCheckoutStatus(order),
        currency: order.currency,
        line_items: order.line_items,
        totals: order.totals,
        buyer: order.buyer || null,
        created_at: order.createdAt,
        updated_at: order.updatedAt || order.createdAt,
        messages: buildCheckoutMessages(order),
        payment: {
            instruments: [paymentInstrument]
        },
        links: buildCheckoutLinks(req, order),
        ucp: buildUcpMetadata(req, order)
    };

    if (order.status === 'PAID') {
        response.order = {
            id: order.merchant_order_id,
            status: 'confirmed'
        };
    }

    return response;
};

const extractTransactionHashFromCompleteRequest = (body) => {
    if (body.transactionHash) return body.transactionHash;

    const payment = body.payment || {};
    const instruments = payment.instruments || [];
    for (let i = 0; i < instruments.length; i += 1) {
        const instrument = instruments[i] || {};
        if (instrument.transaction_hash) return instrument.transaction_hash;
        if (instrument.receipt && instrument.receipt.transaction_hash) return instrument.receipt.transaction_hash;
        if (instrument.credential && instrument.credential.transaction_hash) return instrument.credential.transaction_hash;
    }

    return null;
};

const sendApprovalPrompt = (order, sourceBaseUrl) => {
    const totalAmount = formatBaseUnits(order.amount_in_base_units);
    const approveMsg = `🚨 *UCP Checkout Session*\nSession: \`${order.id}\`\nAmount: *${totalAmount} USDT* on TRON Nile\nMerchant Order: \`${order.merchant_order_id}\``;

    if (bot && TELEGRAM_CHAT_ID) {
        bot.sendMessage(TELEGRAM_CHAT_ID, approveMsg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Approve', callback_data: `approve_${order.id}` }],
                    [{ text: '❌ Reject', callback_data: `reject_${order.id}` }]
                ]
            }
        });
        return;
    }

    console.log(`\n---------------------------------`);
    console.log(`[MOCK TELEGRAM 2FA APP]`);
    console.log(approveMsg);
    console.log(`To approve locally, run: curl -X POST ${sourceBaseUrl}/api/demo/approve-2fa/${order.id}`);
    console.log(`---------------------------------\n`);
};

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_MODE_ENABLED = Boolean(TELEGRAM_TOKEN && TELEGRAM_CHAT_ID);
let bot = null;

if (TELEGRAM_TOKEN) {
    bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
    bot.on('polling_error', (error) => {
        console.error('[Security] Telegram polling error:', error.message);
    });

    bot.onText(/\/start/, (msg) => {
        console.log('\n========== TELEGRAM SETUP ==========');
        console.log(`Your Chat ID is: ${msg.chat.id}`);
        console.log(`Please add TELEGRAM_CHAT_ID=${msg.chat.id} to your .env and restart the server!`);
        console.log('====================================\n');
        bot.sendMessage(msg.chat.id, `Welcome to the TRON UCP demo. Your Chat ID is ${msg.chat.id}. Add this to your .env file as TELEGRAM_CHAT_ID.`);
    });

    bot.on('callback_query', (query) => {
        const action = query.data;
        const msg = query.message;

        if (action.startsWith('approve_')) {
            const checkoutSessionId = action.split('approve_')[1];
            db.updateOrder(checkoutSessionId, {
                status: 'PENDING',
                humanApprovedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            bot.editMessageText(`✅ Approved checkout session: ${checkoutSessionId}`, {
                chat_id: msg.chat.id,
                message_id: msg.message_id
            });
            console.log(`[Security] Checkout session ${checkoutSessionId} approved via Telegram 2FA.`);
        } else if (action.startsWith('reject_')) {
            const checkoutSessionId = action.split('reject_')[1];
            db.updateOrder(checkoutSessionId, {
                status: 'REJECTED',
                updatedAt: new Date().toISOString()
            });
            bot.editMessageText(`❌ Rejected checkout session: ${checkoutSessionId}`, {
                chat_id: msg.chat.id,
                message_id: msg.message_id
            });
            console.log(`[Security] Checkout session ${checkoutSessionId} rejected via Telegram 2FA.`);
        }
    });

    if (TELEGRAM_CHAT_ID) {
        console.log(`[Security] Telegram HITL 2FA Enabled for chat ${TELEGRAM_CHAT_ID}.`);
    } else {
        console.warn('[Security] TELEGRAM_BOT_TOKEN is set but TELEGRAM_CHAT_ID is missing. Falling back to local mock approval mode until TELEGRAM_CHAT_ID is configured.');
    }
} else {
    console.warn('[Security] No TELEGRAM_BOT_TOKEN found in .env. HITL 2FA will run in mock local mode.');
}

app.get('/ucp-explorer', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ucp-explorer.html'));
});

app.get('/.well-known/ucp', (req, res) => {
    res.json(buildBusinessProfile(req));
});

app.post('/ucp/v1/checkout-sessions', (req, res) => {
    let normalizedCheckout;

    try {
        normalizedCheckout = normalizeRequestedLineItems(req.body);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }

    const now = new Date().toISOString();
    const checkoutSessionId = createCheckoutSessionId();
    const order = db.createOrder({
        id: checkoutSessionId,
        merchant_order_id: createMerchantOrderId(checkoutSessionId),
        payment_instrument_id: createPaymentInstrumentId(checkoutSessionId),
        buyer: req.body.buyer || null,
        line_items: normalizedCheckout.lineItems,
        totals: normalizedCheckout.totals,
        currency: normalizedCheckout.currency,
        total_amount: formatBaseUnits(normalizedCheckout.totalBaseUnits),
        amount_in_base_units: normalizedCheckout.totalBaseUnits,
        status: 'AWAITING_2FA',
        txHash: null,
        createdAt: now,
        updatedAt: now
    });

    sendApprovalPrompt(order, getBaseUrl(req));
    return res.status(201).json(buildCheckoutSessionResponse(req, order));
});

app.get('/ucp/v1/checkout-sessions/:id', (req, res) => {
    const order = db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Checkout session not found.' });
    return res.json(buildCheckoutSessionResponse(req, order));
});

app.put('/ucp/v1/checkout-sessions/:id', (req, res) => {
    const order = db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Checkout session not found.' });
    if (order.status === 'PAID') {
        return res.status(409).json({ error: 'Completed checkout sessions cannot be updated.' });
    }

    let updates = {
        buyer: req.body.buyer !== undefined ? req.body.buyer : order.buyer,
        updatedAt: new Date().toISOString()
    };

    if (req.body.line_items || req.body.items) {
        let normalizedCheckout;

        try {
            normalizedCheckout = normalizeRequestedLineItems(req.body);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }

        updates = Object.assign(updates, {
            line_items: normalizedCheckout.lineItems,
            totals: normalizedCheckout.totals,
            currency: normalizedCheckout.currency,
            total_amount: formatBaseUnits(normalizedCheckout.totalBaseUnits),
            amount_in_base_units: normalizedCheckout.totalBaseUnits,
            status: 'AWAITING_2FA',
            txHash: null
        });
    }

    const updatedOrder = db.updateOrder(req.params.id, updates);
    if (updates.status === 'AWAITING_2FA') {
        sendApprovalPrompt(updatedOrder, getBaseUrl(req));
    }

    return res.json(buildCheckoutSessionResponse(req, updatedOrder));
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.post('/ucp/v1/checkout-sessions/:id/complete', async (req, res) => {
    const orderId = req.params.id;
    const transactionHash = extractTransactionHashFromCompleteRequest(req.body);

    if (!transactionHash) {
        return res.status(400).json({ error: 'Missing transaction hash in payment receipt.' });
    }

    const order = db.getOrderById(orderId);
    if (!order) return res.status(404).json({ error: 'Checkout session not found.' });
    if (order.status === 'PAID') return res.json(buildCheckoutSessionResponse(req, order));
    if (order.status === 'REJECTED' || order.status === 'CANCELED') {
        return res.status(409).json({ error: 'Checkout session is no longer payable.' });
    }

    db.updateOrder(orderId, {
        status: 'VERIFYING',
        txHash: transactionHash,
        updatedAt: new Date().toISOString()
    });

    const failOrder = (statusCode, error) => {
        const failedOrder = db.updateOrder(orderId, {
            status: 'FAILED',
            updatedAt: new Date().toISOString()
        });
        return res.status(statusCode).json({
            error,
            checkout_session: buildCheckoutSessionResponse(req, failedOrder)
        });
    };

    try {
        let transaction = null;
        let retries = 20;

        while (retries > 0) {
            try {
                transaction = await tronWeb.trx.getTransaction(transactionHash);
                if (transaction && transaction.ret && transaction.ret[0].contractRet === 'SUCCESS') {
                    break;
                }
            } catch (err) {}

            console.log(`Waiting for transaction ${transactionHash} to be confirmed... (${retries} retries left)`);
            await delay(3000);
            retries -= 1;
        }

        if (!transaction || !transaction.ret || transaction.ret[0].contractRet !== 'SUCCESS') {
            return failOrder(400, 'Transaction not successful yet.');
        }

        const contractData = transaction.raw_data.contract[0];
        if (contractData.type !== 'TriggerSmartContract') {
            return failOrder(400, 'Invalid transaction type for TRC20 transfer.');
        }

        const parameter = contractData.parameter.value;
        const decodedTransfer = decodeTrc20TransferData(parameter.data);
        if (!decodedTransfer) {
            return failOrder(400, 'Not a valid token transfer transaction.');
        }

        const paidTokenContract = normalizeAddress(parameter.contract_address);
        if (paidTokenContract !== TRC20_USDT_CONTRACT) {
            return failOrder(400, 'Transaction targets an unexpected token contract.');
        }

        if (decodedTransfer.recipient !== MERCHANT_ADDRESS) {
            return failOrder(400, 'Transaction recipient does not match the merchant address.');
        }

        if (decodedTransfer.amount !== String(order.amount_in_base_units)) {
            return failOrder(400, 'Transaction amount does not match the checkout amount.');
        }

        const paidOrder = db.updateOrder(orderId, {
            status: 'PAID',
            txHash: transactionHash,
            updatedAt: new Date().toISOString()
        });

        return res.json(buildCheckoutSessionResponse(req, paidOrder));
    } catch (error) {
        console.error('Verification error:', error);
        return res.status(500).json({ error: 'Server error during verification.' });
    }
});

app.post('/ucp/v1/checkout-sessions/:id/cancel', (req, res) => {
    const order = db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Checkout session not found.' });
    if (order.status === 'PAID') {
        return res.status(409).json({ error: 'Completed checkout sessions cannot be canceled.' });
    }

    const canceledOrder = db.updateOrder(req.params.id, {
        status: 'CANCELED',
        updatedAt: new Date().toISOString()
    });

    return res.json(buildCheckoutSessionResponse(req, canceledOrder));
});

app.get('/api/orders', (req, res) => {
    const orders = db.getOrders();
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(orders);
});

app.get('/api/premium-data', (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('UCP ')) {
        const profileUrl = `${getBaseUrl(req)}/.well-known/ucp`;
        res.setHeader('WWW-Authenticate', `UCP url="${profileUrl}"`);
        return res.status(402).json({
            error: 'Payment Required',
            message: 'Premium AI Endpoint. Complete a UCP checkout session before retrying.',
            ucp_profile: profileUrl,
            checkout_service: `${getServiceBaseUrl(req)}/checkout-sessions`
        });
    }

    const receiptTxHash = authHeader.split(' ')[1];
    const orders = db.getOrders();
    const validOrder = orders.find((order) => order.txHash === receiptTxHash && order.status === 'PAID');

    if (!validOrder) {
        return res.status(403).json({ error: 'Forbidden', message: 'Invalid payment receipt.' });
    }

    return res.status(200).json({
        success: true,
        data: {
            confidential_ai_model_weights: '0x8fa9b2...34df',
            weather_forecast: '72F and sunny in Silicon Valley',
            alpha_signals: ['LONG $TRX', 'SHORT $FIAT']
        },
        receipt_used: receiptTxHash,
        checkout_session_id: validOrder.id
    });
});

app.post('/api/demo/approve-2fa/:orderId', (req, res) => {
    const updatedOrder = db.updateOrder(req.params.orderId, {
        status: 'PENDING',
        humanApprovedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    if (!updatedOrder) return res.status(404).json({ error: 'Checkout session not found.' });
    return res.json({ success: true, message: `Checkout session ${req.params.orderId} approved locally.` });
});

app.post('/api/demo/run-agent', (req, res) => {
    exec('node test-agent.js');
    res.json({ success: true, message: 'Agent spawned in background' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`UCP business profile: http://localhost:${PORT}/.well-known/ucp`);
    console.log(`UCP checkout REST base: http://localhost:${PORT}/ucp/v1`);
    console.log(`UCP Explorer at: http://localhost:${PORT}/ucp-explorer`);
    console.log(`[Security] Approval mode: ${TELEGRAM_MODE_ENABLED ? 'Telegram' : 'Local mock approval'}`);
});
