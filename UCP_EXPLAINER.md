# Anatomy of the Universal Commerce Protocol (UCP) on TRON in This Repo

This document explains the current `tron-ucp-x402-demo` repository in plain language.

The short version is:

- UCP is the protocol the agent uses to discover how to pay
- TRON is the blockchain where the payment is actually settled
- this repo combines both in a human-approved checkout flow

The current implementation uses the newer UCP resource model:

- `GET /.well-known/ucp`
- `POST /ucp/v1/checkout-sessions`
- `GET /ucp/v1/checkout-sessions/:id`
- `PUT /ucp/v1/checkout-sessions/:id`
- `POST /ucp/v1/checkout-sessions/:id/complete`
- `POST /ucp/v1/checkout-sessions/:id/cancel`

It does not use the older custom endpoints such as `/api/ucp/checkout/create` or `/api/ucp/checkout/challenge/:id`.

---

## 1. Discovery: `GET /.well-known/ucp`

**Goal:** Let an agent learn what this merchant supports without any hardcoded integration.

In this repo, the merchant exposes a business profile at:

- `GET /.well-known/ucp`

That response is built dynamically in `server.js`. It includes:

- the UCP version
- the shopping service endpoint
- the checkout capability
- the TRON payment handler

Conceptually it looks like this:

```json
{
  "name": "TRON UCP Demo Merchant",
  "url": "http://localhost:8000",
  "ucp": {
    "version": "2026-01-23",
    "services": {
      "dev.ucp.shopping": [
        {
          "endpoint": "http://localhost:8000/ucp/v1"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-01-23"
        }
      ]
    },
    "payment_handlers": {
      "localhost.tron.trc20_usdt": [
        {
          "version": "1.0.0"
        }
      ]
    }
  }
}
```

This tells the agent:

- where checkout lives
- what capability is supported
- what payment rail is available

---

## 2. Payment Gate: `GET /api/premium-data`

**Goal:** Turn a protected API into a machine-readable paywall.

The agent first tries to access:

- `GET /api/premium-data`

If no valid receipt is present, the server responds with:

- `HTTP 402 Payment Required`
- a `WWW-Authenticate` header
- a JSON body containing the profile URL and checkout service URL

That is the trigger for UCP discovery.

So instead of the agent seeing a dead-end error, it gets structured instructions that say, in effect:

"You need to pay first. Here is the merchant profile. Here is the checkout service."

---

## 3. Checkout Creation: `POST /ucp/v1/checkout-sessions`

**Goal:** Ask the merchant to create a payable session for the requested goods.

The demo agent sends a request like this:

```json
{
  "buyer": {
    "id": "agent-xxxx",
    "type": "autonomous_agent"
  },
  "line_items": [
    {
      "item": { "id": "premium_data_access" },
      "quantity": 1
    }
  ]
}
```

The server then:

- validates the requested line items
- calculates the price in base units
- creates a checkout session ID like `chk_...`
- stores the order in `orders.json`
- marks the session as `AWAITING_2FA`
- sends a Telegram approval request, or falls back to local mock approval

The response is a checkout session resource, not a custom `payment_challenge` object.

That session includes a selected payment instrument with TRON-specific display data such as:

- `receiver_address`
- `contract_address`
- `amount`
- `amount_decimal`
- `transfer_state`

At this point the transfer state is:

- `awaiting_human_approval`

---

## 4. Human Approval

**Goal:** Keep the human wallet owner in control.

Every newly created checkout session is frozen until a human approves it.

There are two modes in this repo:

- Telegram mode, if `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are configured
- local mock mode, where the server prints a local approval URL

Approval changes the order status from:

- `AWAITING_2FA` to `PENDING`

Once that happens, the checkout session starts returning:

- `transfer_state: "ready_for_transfer"`

The agent learns this by polling the checkout session resource.

---

## 5. Polling: `GET /ucp/v1/checkout-sessions/:id`

**Goal:** Let the agent observe the checkout state without a custom polling API.

The agent repeatedly calls:

- `GET /ucp/v1/checkout-sessions/:id`

This is how it sees whether the session is:

- still incomplete
- ready for transfer
- rejected
- canceled
- completed

In the current repo, the selected payment instrument's `display.transfer_state` is especially important:

- `awaiting_human_approval`
- `ready_for_transfer`
- `verifying_blockchain_receipt`
- `completed`
- `receipt_rejected`
- `rejected`
- `canceled`

When the agent sees `ready_for_transfer`, it has everything it needs to build the blockchain payment.

---

## 6. TRON Settlement

**Goal:** Move USDT on-chain without giving the merchant custody of the wallet.

The agent uses `TronWeb` to construct a TRC20 transfer on TRON Nile.

Specifically, it triggers:

- `transfer(address,uint256)`

against the configured USDT contract.

The agent signs the transaction locally with its own private key and broadcasts it to the TRON network.

Important security property:

- the private key never leaves the agent side
- the merchant only receives the transaction hash later

So UCP coordinates the payment, but TRON settles it.

---

## 7. Completion: `POST /ucp/v1/checkout-sessions/:id/complete`

**Goal:** Submit the blockchain receipt and let the merchant verify it independently.

After broadcasting the transfer, the agent calls:

- `POST /ucp/v1/checkout-sessions/:id/complete`

and submits the transaction hash inside the payment instrument receipt payload.

The merchant server then:

1. marks the order as `VERIFYING`
2. polls TRON for confirmation
3. checks the transaction succeeded
4. checks it is a `TriggerSmartContract`
5. decodes the TRC20 calldata
6. confirms the token contract matches the expected USDT contract
7. confirms the recipient matches `MERCHANT_ADDRESS`
8. confirms the amount matches the checkout session total

If all checks pass, the order becomes:

- `PAID`

If any check fails, the order becomes:

- `FAILED`

---

## 8. How the TRC20 Calldata Check Works

The repo includes a helper called `decodeTrc20TransferData`.

It reads the raw smart contract call data and checks whether it matches the standard TRC20 transfer selector:

- `a9059cbb`

That selector means:

- `transfer(address,uint256)`

The helper then extracts:

- the recipient address
- the transfer amount

This is what allows the merchant to verify the on-chain payment against the checkout session, instead of trusting whatever the client claims.

---

## 9. Unlocking the Protected Resource

**Goal:** Use the verified blockchain receipt to gain access to the original paid API.

Once the transaction is verified, the agent retries:

- `GET /api/premium-data`

with:

- `Authorization: UCP <transaction_hash>`

The server looks up that hash in `orders.json`. If it belongs to a `PAID` order, the premium payload is returned.

That final step completes the loop:

1. request protected resource
2. discover payment method
3. create checkout session
4. get human approval
5. pay on TRON
6. submit receipt
7. access resource

---

## 10. Why This Repo Matters

This repo demonstrates a practical pattern for agentic commerce:

- standard machine-readable discovery through UCP
- blockchain settlement through TRON
- human approval before money moves
- server-side receipt verification before data is released

That makes the system:

- autonomous enough for agents
- strict enough for merchants
- non-custodial by design

In plain terms, it shows how an AI agent can pay for something by itself without giving up human oversight or wallet safety.
