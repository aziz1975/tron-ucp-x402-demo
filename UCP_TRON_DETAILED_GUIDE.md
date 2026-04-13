# UCP + TRON Detailed Guide for This Repository

This document explains how the current codebase implements an official-style UCP checkout flow on top of the TRON blockchain.

It covers:

- what UCP is
- how discovery works through `/.well-known/ucp`
- what a UCP business profile is
- what checkout sessions are
- what payment handlers are
- how HTTP `402 Payment Required` is used here
- how Telegram approval fits into the flow
- how the TRON transaction is built, signed, broadcast, and verified
- what the UCP-related endpoints are in this repo
- how fees work on the TRON side

Important scope note:

- this repo now follows the latest official UCP REST binding shape much more closely than before
- the checkout API surface is aligned to the official `checkout-sessions` resource model
- the TRON payment handler itself is still repo-specific, because UCP is payment-rail agnostic and this project chooses TRON Nile + TRC20 USDT as its settlement mechanism

## 1. What UCP Is

UCP stands for Universal Commerce Protocol.

It is an open protocol for standardized machine-to-machine commerce. In practice, it gives a platform, agent, or merchant a common language for:

- discovery
- capability negotiation
- checkout creation
- payment completion
- post-payment continuation

UCP does not itself move money on-chain. It defines how systems describe commercial intent and how they coordinate around payment.

In this project:

- UCP is the commerce protocol and API contract
- TRON is the blockchain settlement rail

That separation is important:

- UCP tells the agent what service exists, what capability is offered, and how to drive the checkout flow
- TRON is where the actual USDT transfer is signed and broadcast

## 2. How UCP and TRON Are Connected in This Repo

The current repo uses UCP for orchestration and TRON for settlement.

At a high level:

1. The merchant publishes a UCP business profile at `/.well-known/ucp`
2. That profile advertises the official checkout capability `dev.ucp.shopping.checkout`
3. The profile also points to a shopping service endpoint at `/ucp/v1`
4. The agent creates a checkout session at `/ucp/v1/checkout-sessions`
5. The checkout session includes a selected payment instrument that describes the TRON payment details
6. The agent uses `TronWeb` to make a TRC20 `transfer(address,uint256)` call
7. The agent completes the checkout session by submitting the blockchain receipt
8. The merchant verifies the TRON transaction and marks the checkout completed

So the link is:

- UCP describes and structures the checkout
- TRON executes the token transfer that satisfies it

## 3. Official UCP vs This Repo

This repo now uses the latest official-style UCP REST binding shape for discovery and checkout resources.

Specifically, it now uses:

- a business profile at `GET /.well-known/ucp`
- a service declaration for `dev.ucp.shopping`
- the official checkout capability `dev.ucp.shopping.checkout`
- a checkout session resource under `/ucp/v1/checkout-sessions`

That is a major improvement over the older repo shape, which used:

- `dev.ucp.checkout`
- `POST /api/ucp/checkout/create`
- `GET /api/ucp/checkout/challenge/:orderId`
- `POST /api/ucp/checkout/complete`

What remains custom:

- the TRON payment handler definition
- the exact payment instrument display fields used to carry TRON transfer details
- the Telegram human approval step
- the use of the TRON `txHash` as the protected-resource receipt token

So the right way to think about the repo now is:

- official-style UCP business profile and checkout-session API
- repo-specific TRON settlement adapter layered into that structure

## 4. Core Terms in the Current Codebase

### 4.1 `/.well-known/ucp`

This is the UCP discovery endpoint.

In internet protocols, `/.well-known/...` is the standard place to publish machine-readable metadata. In UCP, that location publishes the merchant's business profile.

In this repo, `GET /.well-known/ucp` is implemented in `server.js` and returns a business profile built by `buildBusinessProfile(req)`.

That business profile includes:

- merchant name and description
- UCP version
- declared services
- declared capabilities
- declared payment handlers

### 4.2 Business Profile

The business profile is the JSON document returned from `/.well-known/ucp`.

In the current server, it looks conceptually like this:

```json
{
  "name": "TRON UCP Demo Merchant",
  "description": "A TRON Nile UCP checkout demo aligned to the official UCP checkout session REST shape.",
  "url": "http://localhost:8000",
  "ucp": {
    "version": "2026-01-23",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-01-23",
          "endpoint": "http://localhost:8000/ucp/v1",
          "spec": "https://ucp.dev/latest/specification/checkout-rest/"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-01-23",
          "spec": "https://ucp.dev/latest/specification/checkout/",
          "schema": "https://ucp.dev/2026-01-23/schemas/shopping/checkout.json"
        }
      ]
    },
    "payment_handlers": {
      "localhost.tron.trc20_usdt": [
        {
          "version": "1.0.0",
          "spec": "http://localhost:8000/public/tron-nile-trc20-usdt-handler.json",
          "schema": "http://localhost:8000/public/tron-nile-trc20-usdt-handler.schema.json"
        }
      ]
    }
  }
}
```

This profile tells the agent:

- what version of UCP the merchant is speaking
- where the checkout REST service lives
- what checkout capability is offered
- which payment handlers exist

### 4.3 Discovery

Discovery is the process by which the agent learns how to interact with the merchant.

In this repo, discovery works like this:

1. The agent requests the protected resource
2. The server returns HTTP `402 Payment Required`
3. The response includes a `WWW-Authenticate` header with the UCP profile URL
4. The agent fetches `/.well-known/ucp`
5. The agent reads the business profile
6. The agent extracts the shopping service endpoint and capability information

So discovery here is not abstract. It is the concrete path from:

- `402`
- to `/.well-known/ucp`
- to `ucp.services.dev.ucp.shopping[0].endpoint`

### 4.4 `ucpManifestUrl`

The agent code still uses the variable name `ucpManifestUrl`, but in the current implementation it now actually refers to the UCP business profile URL, not the old flat custom manifest.

In `test-agent.js`:

```js
const wwwAuth = error.response.headers['www-authenticate'];
if (wwwAuth && wwwAuth.indexOf('UCP url=') !== -1) {
  ucpManifestUrl = wwwAuth.split('url="')[1].split('"')[0];
} else {
  ucpManifestUrl = error.response.data.ucp_profile;
}
```

That variable now points to:

- `http://localhost:8000/.well-known/ucp`

### 4.5 Services

In UCP, a service is how the business profile tells the client where a particular interaction model lives.

This repo declares:

- `dev.ucp.shopping`

with endpoint:

- `http://localhost:8000/ucp/v1`

The agent reads that value and then builds resource URLs under that base.

### 4.6 Capabilities

A capability tells the client what the merchant supports.

This repo now declares the official checkout capability:

- `dev.ucp.shopping.checkout`

That tells the agent the merchant supports the standardized checkout flow.

### 4.7 Payment Handler

The payment handler tells the client how payment is expected to be satisfied.

In this repo, the payment handler is custom and TRON-specific:

- handler id: `localhost.tron.trc20_usdt`

The business profile points to:

- `public/tron-nile-trc20-usdt-handler.json`
- `public/tron-nile-trc20-usdt-handler.schema.json`

Those files describe the TRON-specific payment method used by the checkout session.

### 4.8 Handler ID Consistency

The payment handler id must stay consistent across the whole flow.

In this repo, the handler id is:

- `localhost.tron.trc20_usdt`

That same id must appear in three places:

1. In the UCP business profile under `ucp.payment_handlers`
2. In the checkout session under the selected payment instrument's `handler_id`
3. In the agent logic when it decides which payment metadata and receipt format to use

Why this matters:

- the business profile tells the agent what payment handlers exist
- the checkout session tells the agent which one is selected for this specific purchase
- the agent must match those two pieces correctly so it can interpret the transfer instructions and submit the correct receipt shape

So the rule is:

- the handler id published at discovery time
- the handler id attached to the checkout session
- and the handler metadata the agent uses

must all refer to the same payment method.

### 4.9 Checkout Session

A checkout session is the main resource in the official-style flow.

It is the server-side object that represents:

- what the buyer wants
- what the merchant expects to be paid
- the current payment state
- what payment instrument should be used
- whether the session is incomplete, completed, or canceled

In this repo, checkout sessions are stored in `orders.json` using `db.js`, but exposed through official-style REST endpoints.

### 4.10 Payment Instrument

Inside a checkout session response, this repo returns:

- `payment.instruments`

The selected instrument carries the TRON transfer data in its `display` fields:

- network
- asset
- contract address
- receiver address
- amount
- amount in decimal
- transfer state

This is the current repo's bridge between the UCP session model and TRON settlement details.

### 4.11 Challenge

In the old repo, a "challenge" was a separate custom endpoint response.

In the new implementation, the standalone challenge endpoint is gone.

Conceptually, the challenge still exists, but it is now represented as:

- checkout session state
- selected payment instrument data
- payment handler config

So instead of a separate `payment_challenge` document, the agent now polls the checkout session resource until the selected payment instrument has `transfer_state: ready_for_transfer`.

### 4.12 Receipt Exchange

Receipt exchange is still present, but now it happens through:

- `POST /ucp/v1/checkout-sessions/:id/complete`

The receipt submitted by the agent is the blockchain transaction hash:

```json
{
  "payment": {
    "instruments": [
      {
        "credential": {
          "type": "blockchain_receipt",
          "transaction_hash": "..."
        }
      }
    ]
  }
}
```

That is then verified by the backend against TRON.

## 5. UCP-Related Endpoints in This Repository

This repo has both:

- UCP-related endpoints
- non-UCP helper endpoints

### 5.1 `GET /.well-known/ucp`

Role:

- discovery endpoint
- returns the UCP business profile

The agent uses it to learn:

- the UCP version
- the shopping service endpoint
- the checkout capability
- the payment handler

### 5.2 `POST /ucp/v1/checkout-sessions`

Role:

- create a checkout session
- normalize requested line items
- compute totals
- create internal order state
- trigger Telegram approval workflow

This is the official-style replacement for the old custom `checkout/create` endpoint.

### 5.3 `GET /ucp/v1/checkout-sessions/:id`

Role:

- fetch current checkout session state
- allow the agent to poll until payment is ready

The agent uses this endpoint instead of the old custom challenge polling endpoint.

### 5.4 `PUT /ucp/v1/checkout-sessions/:id`

Role:

- update buyer or line-item data before the session is completed
- reset approval/payment state if line items change

This aligns the repo more closely with the official resource model even though the demo agent does not currently use this path.

### 5.5 `POST /ucp/v1/checkout-sessions/:id/complete`

Role:

- accept payment receipt data
- extract the blockchain transaction hash
- verify the payment on TRON
- transition the session to completed if valid

This is the bridge between UCP orchestration and blockchain settlement proof.

### 5.6 `POST /ucp/v1/checkout-sessions/:id/cancel`

Role:

- cancel an incomplete session
- prevent further payment completion attempts

### 5.7 `GET /api/premium-data`

Role:

- protected premium API resource
- triggers the UCP flow through HTTP `402`
- later accepts the receipt token in `Authorization: UCP <txHash>`

This is not itself a UCP endpoint, but it is the entry point into the commerce flow.

### 5.8 Demo/Helper Endpoints

These are not official UCP endpoints:

- `POST /api/demo/approve-2fa/:orderId`
  - local mock approval shortcut if Telegram is not configured
- `POST /api/demo/run-agent`
  - launches the demo agent script
- `GET /api/orders`
  - dashboard support endpoint

## 6. Full End-to-End Flow in the Current Repo

### Step 1. Agent hits the protected API

The agent requests:

- `GET /api/premium-data`

Without a valid receipt, the server responds with HTTP `402 Payment Required` and includes a UCP profile URL.

Current server behavior:

```js
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
```

### Step 2. Agent performs discovery

The agent parses the `WWW-Authenticate` header, extracts the business profile URL, and fetches it:

```js
const manifestRes = await axios.get(ucpManifestUrl, {
  headers: getUcpAgentHeaders()
});
const manifest = manifestRes.data;
```

It then reads:

- `manifest.ucp.services.dev.ucp.shopping[0].endpoint`
- `manifest.ucp.capabilities.dev.ucp.shopping.checkout`

That tells the agent:

- where the checkout service lives
- that the merchant supports checkout

### Step 3. Agent creates a checkout session

The agent creates a session by calling:

- `POST /ucp/v1/checkout-sessions`

Example agent request:

```js
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
```

The server:

- normalizes line items
- looks up item pricing from the local catalog
- computes totals
- creates an internal checkout session id
- stores state in `orders.json`
- marks the internal order as `AWAITING_2FA`
- sends Telegram approval or prints a mock approval command

### Step 4. Human approval blocks payment readiness

The session exists immediately, but the transfer is not ready until a human approves it.

This repo uses Telegram as the real approval mode:

- the server sends an inline Telegram message
- the user taps Approve or Reject

If Telegram is not configured, the server prints a local `curl` command for approval testing.

This is repo-specific business logic layered on top of the checkout session resource.

### Step 5. Agent polls the checkout session

The agent now polls:

- `GET /ucp/v1/checkout-sessions/:id`

It waits until the selected payment instrument says:

- `transfer_state: ready_for_transfer`

Relevant agent logic:

```js
while (checkoutSession.status === 'incomplete') {
  const paymentInstrument = getSelectedPaymentInstrument(checkoutSession);
  const display = paymentInstrument ? paymentInstrument.display || {} : {};
  const transferState = display.transfer_state;

  if (transferState === 'ready_for_transfer') {
    break;
  }

  const pollRes = await axios.get(`${checkoutSessionsUrl}/${checkoutSession.id}`, {
    headers: getUcpAgentHeaders()
  });
  checkoutSession = pollRes.data;
}
```

This replaces the old standalone challenge endpoint.

### Step 6. Agent reads the payment instrument

Once the session is ready, the selected payment instrument provides the TRON transfer details:

```json
{
  "id": "pi_...",
  "type": "blockchain_transfer",
  "handler_id": "localhost.tron.trc20_usdt",
  "selected": true,
  "display": {
    "network": "TRON_NILE",
    "asset": "TRC20_USDT",
    "contract_address": "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
    "receiver_address": "T...",
    "amount": "15000000",
    "amount_decimal": "15.000000",
    "transfer_state": "ready_for_transfer"
  }
}
```

This is the current equivalent of the old payment challenge.

### Step 7. Agent builds the TRON transaction

The agent uses `TronWeb` to create a smart-contract call:

```js
const transaction = await tronWeb.transactionBuilder.triggerSmartContract(
  contractAddress,
  'transfer(address,uint256)',
  {},
  parameters,
  ownerAddress
);
```

Where:

- `contractAddress` is the TRC20 USDT contract
- `parameters[0]` is the merchant receiver address
- `parameters[1]` is the token amount in base units

This creates an unsigned TRON transaction that calls:

- `transfer(address,uint256)`

on the TRC20 token contract.

### Step 8. Agent signs and broadcasts

The agent signs the transaction locally with its own private key:

```js
const signedTx = await tronWeb.trx.sign(transaction.transaction);
await tronWeb.trx.sendRawTransaction(signedTx);
const txHash = signedTx.txID;
```

This is the actual blockchain payment.

Important properties:

- the agent keeps custody of the key
- the merchant never holds the agent key
- only the resulting transaction hash is shared back with the merchant

### Step 9. Agent completes the checkout session with a receipt

After broadcasting, the agent calls:

- `POST /ucp/v1/checkout-sessions/:id/complete`

It sends the transaction hash as a blockchain receipt:

```js
const completeRes = await axios.post(`${checkoutSessionsUrl}/${checkoutSession.id}/complete`, {
  payment: {
    instruments: [{
      id: paymentInstrument.id,
      selected: true,
      handler_id: paymentInstrument.handler_id,
      credential: {
        type: 'blockchain_receipt',
        transaction_hash: txHash
      }
    }]
  }
});
```

### Step 10. Merchant verifies the TRON payment

The backend then:

1. fetches the transaction from TRON
2. checks that it succeeded
3. checks that it is a `TriggerSmartContract`
4. checks that the token contract is the expected USDT contract
5. decodes the transfer calldata
6. checks that the recipient matches `MERCHANT_ADDRESS`
7. checks that the amount matches the checkout session amount

Relevant logic:

```js
const contractData = transaction.raw_data.contract[0];
const parameter = contractData.parameter.value;
const decodedTransfer = decodeTrc20TransferData(parameter.data);

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
```

If the transaction is valid, the session becomes completed.

### Step 11. Agent redeems the receipt at the premium API

After successful verification, the agent can access the protected endpoint by sending:

```js
Authorization: UCP <txHash>
```

The server looks up the internal order by `txHash` and checks that its status is `PAID`.

If valid, the premium response is returned.

## 7. How HTTP 402 Is Implemented Here

This repo implements HTTP `402 Payment Required` directly in Express.

Important points:

- `402` is a standard HTTP status code
- UCP does not "own" the status code
- this repo uses `402` as the machine-readable entry point into the UCP discovery flow

So this implementation is:

- application code
- UCP-oriented in design
- not a special UCP runtime primitive by itself

Current implementation:

```js
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
```

What this does:

- signals payment is required
- points the agent to the UCP business profile
- gives the agent enough data to begin discovery

The exact `WWW-Authenticate: UCP url="..."` pattern is a design choice used by this repo to make discovery easy for the demo agent.

## 8. How the TRON Transaction Happens in Code

The actual payment is a TRC20 smart-contract call on TRON Nile.

The agent uses:

- `triggerSmartContract`
- `transfer(address,uint256)`
- `sign`
- `sendRawTransaction`

Core flow:

```js
const transaction = await tronWeb.transactionBuilder.triggerSmartContract(
  contractAddress,
  'transfer(address,uint256)',
  {},
  parameters,
  ownerAddress
);

const signedTx = await tronWeb.trx.sign(transaction.transaction);
await tronWeb.trx.sendRawTransaction(signedTx);
const txHash = signedTx.txID;
```

Breaking this down:

- `triggerSmartContract(...)`
  - creates a TRON smart-contract transaction
- `'transfer(address,uint256)'`
  - calls the TRC20 token transfer method
- `parameters`
  - contain destination address and amount
- `sign(...)`
  - signs with the agent's private key
- `sendRawTransaction(...)`
  - broadcasts to TRON Nile
- `txID`
  - becomes the blockchain receipt reference

## 9. How the Backend Decodes and Verifies the Transfer

The backend does not blindly trust the agent.

It independently decodes the TRC20 calldata:

```js
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
```

Why this matters:

- `a9059cbb` is the function selector for `transfer(address,uint256)`
- the next 32 bytes are the recipient
- the next 32 bytes are the amount

That lets the backend compare the on-chain payment with the checkout session the merchant created.

## 10. How Telegram Approval Fits In

Telegram is not part of UCP itself. It is the repo's human-in-the-loop approval layer.

The current server behavior is:

- when a checkout session is created, the merchant does not immediately release payment readiness
- instead, the server sends a Telegram inline message with Approve and Reject buttons
- approval changes internal state to `PENDING`
- rejection changes internal state to `REJECTED`

The agent then learns this indirectly by polling the checkout session resource:

- `AWAITING_2FA` maps to `transfer_state: awaiting_human_approval`
- `PENDING` maps to `transfer_state: ready_for_transfer`

So Telegram approval does not add a new UCP endpoint. It changes the state of the checkout session.

## 11. How Fees Work at the TRON Level Here

This repo uses smart-contract execution on TRON, not a simple native TRX transfer.

That means the sender pays chain-level costs through TRON resources such as:

- Bandwidth
- Energy

### 11.1 Who pays the fee

The sender wallet pays the blockchain execution cost.

In this repo, that is the agent wallet configured by:

- `TRON_PRIVATE_KEY`

The merchant does not pay for the sender's outbound TRC20 transfer.

### 11.2 Why a TRC20 transfer has chain cost

A TRC20 transfer is a smart-contract call.

That means:

- token contract logic executes
- Energy is consumed
- if resources are insufficient, TRX may be burned to complete execution

### 11.3 How the current code handles fees

The current demo does not explicitly estimate or surface fees.

The transaction builder call is:

```js
const transaction = await tronWeb.transactionBuilder.triggerSmartContract(
  contractAddress,
  'transfer(address,uint256)',
  {},
  parameters,
  ownerAddress
);
```

The options object is just `{}`.

So the repo currently does not:

- set an explicit `feeLimit`
- estimate Energy usage before sending
- show cost projections in the UI

For a demo on Nile, that can be acceptable if the sender account has enough resources. For production, you would typically want:

- Energy estimation
- explicit `feeLimit`
- balance/resource checks
- explicit handling for `OUT_OF_ENERGY` and other execution failures

### 11.4 What can still fail even if UCP is correct

Even if the UCP flow is perfectly valid, the TRON transaction can still fail if:

- the sender lacks TRX
- the sender lacks Energy or Bandwidth
- the smart-contract execution runs out of resources
- the token contract reverts

So UCP correctness and blockchain execution success are related but separate concerns.

## 12. Internal State Model

Internally, this repo stores sessions in `orders.json` through `db.js`.

Important internal states include:

- `AWAITING_2FA`
- `PENDING`
- `VERIFYING`
- `PAID`
- `FAILED`
- `REJECTED`
- `CANCELED`

These are internal storage states. The public checkout session response maps them into UCP-style session status and payment instrument transfer state.

## 13. Official UCP Endpoints vs This Repo's Current Endpoints

### Official UCP checkout REST binding

The official REST binding describes resource-style operations such as:

- `POST /checkout-sessions`
- `GET /checkout-sessions/{id}`
- `PUT /checkout-sessions/{id}`
- `POST /checkout-sessions/{id}/complete`
- `POST /checkout-sessions/{id}/cancel`

### This repo's current UCP-style implementation

This repo now uses those same resource ideas under the service base:

- `GET /.well-known/ucp`
- `POST /ucp/v1/checkout-sessions`
- `GET /ucp/v1/checkout-sessions/:id`
- `PUT /ucp/v1/checkout-sessions/:id`
- `POST /ucp/v1/checkout-sessions/:id/complete`
- `POST /ucp/v1/checkout-sessions/:id/cancel`

That means the repo is now structurally aligned with the latest official UCP REST binding, while the payment handler and blockchain details remain TRON-specific.

## 14. Complete One-Sentence Summary

In this repository, the merchant publishes an official-style UCP business profile and checkout-session REST service, the agent discovers that service through HTTP `402` and `/.well-known/ucp`, completes a checkout session, settles the payment by broadcasting a TRC20 USDT transfer on TRON Nile, submits the transaction hash as a blockchain receipt, and then uses that verified receipt to unlock the protected API.

## 15. Official Source Links

### UCP

- UCP home: https://ucp.dev/2026-01-23/
- UCP official overview: https://ucp.dev/latest/specification/overview/
- UCP core concepts: https://ucp.dev/2026-01-23/documentation/core-concepts/
- UCP checkout capability overview: https://ucp.dev/latest/specification/checkout/
- UCP checkout REST binding: https://ucp.dev/latest/specification/checkout-rest/
- UCP schema reference: https://ucp.dev/2026-01-23/specification/reference/
- UCP GitHub repository: https://github.com/Universal-Commerce-Protocol/ucp

### TRON

- TRON resource model, Energy, and Bandwidth: https://developers.tron.network/docs/resource-model
- TronWeb `triggerSmartContract` reference: https://developers.tron.network/v4.4.0/reference/tronweb-triggersmartcontract
- TRON FAQ including fee and execution guidance: https://developers.tron.network/docs/faq

## 16. Recommended Reading Order

If you are new to this topic, read in this order:

1. Section 1 and Section 2 for the core model
2. Section 4 for terminology
3. Section 5 for endpoint roles
4. Section 6 for the full request-by-request flow
5. Section 7, Section 8, and Section 9 for the concrete code behavior
6. Section 10 and Section 11 for approval and fees
7. Section 15 for the official docs
