# How This Repo Lets an AI Agent Pay on TRON Using UCP

## A simple demo of agent payments, human approval, and on-chain verification

AI agents are getting better at using tools, calling APIs, and making decisions. But there is still a basic problem on the internet:

How does an agent pay for something?

If an API charges money, most systems still assume a human will log in, enter a card, approve a checkout page, and finish the payment manually. That model does not fit autonomous software.

This repository, `tron-ucp-x402-demo`, shows a different path.

It combines:

- UCP for machine-readable commerce
- HTTP `402 Payment Required` for discovery
- TRON Nile for settlement with TRC20 USDT
- Telegram approval for human control
- server-side blockchain verification before releasing the paid resource

In plain language, this repo shows how an AI agent can hit a paid API, discover how to pay, wait for a human approval step, broadcast a TRON payment, submit the transaction hash as proof, and then unlock the protected data.

That is the full story this demo tells.

---

## Clone the repo and run it locally

If you want to explore the demo while reading this article, clone the repository with:

```bash
git clone https://github.com/<your-org>/<your-repo>.git
cd tron-ucp-x402-demo
npm install
cd frontend && npm install && cd ..
```

The backend is expected to run on port `8000`, which matches the current `.env.example` and the built-in demo flow.

---

## What this repo actually contains

The repo is not just one server file. It is a small end-to-end system with four main parts.

### 1. The UCP merchant server

The Express server in `server.js` is the core of the project.

It:

- publishes a UCP business profile at `/.well-known/ucp`
- creates checkout sessions at `/ucp/v1/checkout-sessions`
- lets agents poll checkout state at `/ucp/v1/checkout-sessions/:id`
- verifies payment receipts at `/ucp/v1/checkout-sessions/:id/complete`
- protects the paid resource at `/api/premium-data`
- exposes live order data for the dashboard at `/api/orders`

### 2. The demo agent

The file `test-agent.js` acts like a simple autonomous buyer.

It:

- tries to access the premium API
- gets an HTTP `402`
- discovers the UCP business profile
- creates a checkout session
- polls the checkout session until human approval is complete
- signs and broadcasts a TRC20 USDT transfer on TRON Nile
- submits the transaction hash back to the merchant
- retries the premium API with the receipt

### 3. The merchant dashboard

The React app in `frontend/src/App.jsx` is the operator view.

It gives the merchant:

- an overview screen
- a payments table
- balances and customer views
- a developer-themed UI section
- a "Run Live Demo Agent" button

One useful detail: the demo modal is a timed narration in the frontend, while the real agent runs in the background on the server. So the UI is showing a guided story of the flow while the actual checkout logic happens in `test-agent.js`.

### 4. The human approval layer

The repo uses Telegram as the human-in-the-loop gate. If Telegram is configured, the merchant gets an approval message with inline buttons. If it is not configured, the server falls back to a local mock approval flow and prints a local approval URL to the console.

That means the demo still works without Telegram, but the control model stays the same:

no transfer is supposed to proceed until a human approves it.

---

## Why UCP matters here

The important idea in this repo is that the agent does not start with hardcoded payment instructions.

Instead, it learns them through UCP.

UCP, short for Universal Commerce Protocol, gives systems a standard way to describe:

- what a merchant offers
- what checkout capability exists
- where the checkout service lives
- what payment handler is available

In this repo, the merchant publishes a business profile at:

- `GET /.well-known/ucp`

That profile tells the agent:

- the UCP version in use
- that the merchant supports `dev.ucp.shopping.checkout`
- that the shopping service endpoint is `/ucp/v1`
- that a TRON-specific payment handler is available

This is a big improvement over hardcoded wallet integrations.

Without a discovery layer like this, every agent would need custom logic for every merchant. With UCP, the merchant can publish a machine-readable profile and the agent can adapt to it at runtime.

---

## Why HTTP 402 is the right starting point

This demo uses `GET /api/premium-data` as the paid resource.

When the agent tries to access it without proof of payment, the server does not send a generic error. It returns:

- `HTTP 402 Payment Required`
- a `WWW-Authenticate` header
- a JSON body with the UCP profile URL and checkout service URL

This matters because the agent does not just learn that access is blocked. It learns what to do next.

The flow becomes:

1. Try to access the resource
2. Receive a payment requirement
3. Discover how the merchant wants to be paid
4. Start a checkout session

That is a much more agent-friendly model than a human checkout page or a documentation link.

---

## The current flow in this repo

One thing worth stressing: this repo uses the current checkout session model, not the older custom endpoints that existed in earlier versions of the project.

The main UCP endpoints in the current code are:

- `GET /.well-known/ucp`
- `POST /ucp/v1/checkout-sessions`
- `GET /ucp/v1/checkout-sessions/:id`
- `PUT /ucp/v1/checkout-sessions/:id`
- `POST /ucp/v1/checkout-sessions/:id/complete`
- `POST /ucp/v1/checkout-sessions/:id/cancel`

That means the agent does not poll a separate custom "challenge" endpoint anymore. It polls the checkout session resource itself and watches the selected payment instrument state change over time.

Here is the full lifecycle in simple language.

### Step 1: The agent asks for premium data

The demo agent calls:

- `GET /api/premium-data`

Because it does not yet have a receipt, the merchant returns `402 Payment Required`.

### Step 2: The agent discovers the UCP business profile

The agent reads the `WWW-Authenticate` header, extracts the `/.well-known/ucp` URL, and fetches it.

From that profile it learns:

- the checkout service endpoint
- the checkout capability
- the TRON payment handler metadata

### Step 3: The agent creates a checkout session

The agent calls:

- `POST /ucp/v1/checkout-sessions`

with a buyer object and a line item for `premium_data_access`.

The merchant server creates a record in `orders.json` and returns a checkout session resource.

This resource includes a selected payment instrument with TRON details such as:

- receiver address
- contract address
- amount in base units
- decimal amount for display
- transfer state

At first, the transfer state is:

- `awaiting_human_approval`

### Step 4: The merchant approves or rejects the session

When the session is created, the server sends a Telegram prompt or prints a local mock approval link.

If approved, the order status moves to `PENDING`, and the payment instrument starts reporting:

- `transfer_state: ready_for_transfer`

If rejected, the session becomes unusable for payment.

### Step 5: The agent polls the checkout session

The agent keeps calling:

- `GET /ucp/v1/checkout-sessions/:id`

until the session becomes ready.

This is an important design choice. The checkout session resource itself is the source of truth. There is no need for a separate polling API just to ask whether approval happened.

### Step 6: The agent builds and sends the TRON payment

Once the session is ready, the agent uses `TronWeb` to build a smart contract call:

- `transfer(address,uint256)`

against the configured TRC20 USDT contract on TRON Nile.

The agent signs the transaction locally with its own private key and broadcasts it to the network.

This means the merchant never gets custody of the wallet.

### Step 7: The agent submits the receipt

After broadcast, the agent sends the transaction hash to:

- `POST /ucp/v1/checkout-sessions/:id/complete`

The server immediately marks the order as `VERIFYING` and then performs its own verification against TRON.

### Step 8: The merchant verifies the transaction on-chain

This is where the repo becomes more than a mock.

The merchant does not trust the client blindly. The server checks:

- whether the transaction exists
- whether it succeeded
- whether it is a `TriggerSmartContract`
- whether the token contract matches the expected USDT contract
- whether the recipient matches `MERCHANT_ADDRESS`
- whether the amount matches the checkout session total

To do the recipient and amount checks, the server decodes the TRC20 calldata with `decodeTrc20TransferData`.

### Step 9: The paid API is unlocked

If verification succeeds, the order becomes `PAID`.

The agent then retries:

- `GET /api/premium-data`

with:

- `Authorization: UCP <transaction_hash>`

The server finds the matching paid order and returns the premium payload.

That completes the loop.

---

## A closer look at the TRON verification logic

The most interesting part of the backend is probably not session creation. It is receipt verification.

The repo verifies a TRC20 transfer by reading the raw smart contract data.

The helper `decodeTrc20TransferData` does three core things:

1. It confirms the calldata starts with `a9059cbb`
2. It extracts the encoded recipient address
3. It extracts the encoded transfer amount

That selector, `a9059cbb`, corresponds to:

- `transfer(address,uint256)`

After decoding, the merchant compares the transaction contents with the checkout session that was originally created.

That is why the server can safely decide whether the agent really paid the right wallet, the right token, and the right amount.

This is one of the strongest parts of the repo, because it makes the payment proof verifiable instead of trust-based.

---

## What the order store tracks

The state store in this project is simple by design. It uses `orders.json` and a small helper module in `db.js`.

Each order tracks fields such as:

- checkout session ID
- merchant order ID
- payment instrument ID
- buyer object
- line items
- totals
- amount in base units
- status
- transaction hash
- timestamps

The main statuses are:

- `AWAITING_2FA`
- `PENDING`
- `VERIFYING`
- `PAID`
- `FAILED`
- `REJECTED`
- `CANCELED`

The server maps those internal states into UCP-style checkout states and user-facing transfer states. That gives the agent a stable resource to read, while still letting the merchant keep a simple internal model.

---

## What makes this repo useful beyond the demo

This project is useful because it shows a realistic security posture for agent payments.

It does not solve the problem by giving an agent unlimited wallet control and hoping for the best.

Instead, it combines four useful properties:

### 1. Machine-readable discovery

The agent learns how to pay from the merchant itself.

### 2. Human approval before transfer

The merchant has a final say before funds move.

### 3. Non-custodial settlement

The agent signs locally. The merchant never receives the private key.

### 4. Independent receipt verification

The merchant validates the transaction on-chain before releasing the paid data.

That combination is much closer to what real agent commerce needs:

automation with guardrails.

---

## What is demo-only in the current repo

The repo is solid as a demo, but it is still a demo.

A few things are intentionally simplified:

- settlement is hardcoded to TRON Nile testnet
- product catalog is a single premium item
- storage is a flat JSON file, not a database
- the dashboard contains some static UI sections meant to look like a merchant console
- the live modal is a guided narration, not a real-time stream of backend logs

That does not reduce the value of the project. It just defines the scope clearly.

The important part is that the commerce flow itself is real:

- the server returns `402`
- the agent discovers the business profile
- the checkout session is created
- approval is required
- the transaction is broadcast
- the receipt is verified
- access is granted only after payment is confirmed

---

## One practical detail: the repo expects port 8000 for the server

The demo agent and the frontend both call:

- `http://localhost:8000`

That matches the included `.env.example`, which sets:

- `PORT=8000`

So if you run this repo locally, the backend should use port `8000` or the built-in demo flows will not line up.

---

## Why this architecture is a good pattern for agent commerce

A lot of agent payment discussions stay abstract. This repo is useful because it makes the ideas concrete.

It shows that an agent payment system can be:

- discoverable
- API-native
- non-custodial
- human-approved
- blockchain-verifiable

That is a strong pattern for paid APIs, licensed datasets, premium model access, machine-to-machine subscriptions, and other services where software needs to buy something directly.

UCP handles the language of commerce.

TRON handles the movement of money.

The merchant keeps control through approval and verification.

That is the core idea.

---

## Final takeaway

``tron-ucp-x402-demo is a useful demonstration of where agent payments can go next.

It does not treat payment as a hidden side effect. It makes payment part of the protocol.

The agent:

- asks for a resource
- learns how to pay
- waits for approval
- settles on-chain
- submits proof
- gets access

And the merchant:

- publishes a machine-readable business profile
- controls approval
- verifies payment independently
- releases the protected asset only after confirmation

That is a clean model for agentic commerce.

If you want to understand how UCP and TRON can work together in a practical repo, this project is a very good place to start.

---

## Useful official links

If you want to go deeper, these are the most useful primary references behind the ideas used in this repo:

### UCP

- UCP home: https://ucp.dev/
- UCP specification overview: https://ucp.dev/specification/overview/
- UCP core concepts: https://ucp.dev/2026-01-23/documentation/core-concepts/
- UCP checkout capability: https://ucp.dev/latest/specification/checkout/
- UCP checkout REST binding: https://ucp.dev/latest/specification/checkout-rest/
- UCP schema reference: https://ucp.dev/latest/specification/reference/
- UCP GitHub repository: https://github.com/Universal-Commerce-Protocol/ucp

### HTTP 402

- HTTP Semantics RFC 9110, Section 15.5.3 (`402 Payment Required`): https://www.rfc-editor.org/rfc/rfc9110#section-15.5.3
- MDN reference for `402 Payment Required`: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/402

One important nuance: the official HTTP standard says `402 Payment Required` is reserved for future use, while this repo uses it pragmatically as the machine-readable trigger that points the agent into the UCP discovery flow.

---

## X Thread Version

1. Most AI agents can call APIs, but they still struggle to pay for things. `tron-ucp-x402-demo` shows a cleaner model: UCP for discovery, TRON for settlement, Telegram for human approval, and server-side verification before releasing the paid resource.

2. In this repo, the agent first calls `GET /api/premium-data`. It gets `402 Payment Required`, plus a `WWW-Authenticate` header pointing to `/.well-known/ucp`. That turns a paywall into a machine-readable workflow.

3. The merchant publishes a UCP business profile at `/.well-known/ucp`. The agent learns the checkout service endpoint (`/ucp/v1`), the checkout capability (`dev.ucp.shopping.checkout`), and the TRON payment handler.

4. The agent creates a checkout session at `POST /ucp/v1/checkout-sessions`. The server stores it, marks it `AWAITING_2FA`, and sends a Telegram approval prompt or falls back to local mock approval.

5. Instead of polling a custom challenge endpoint, the agent polls `GET /ucp/v1/checkout-sessions/:id`. When the merchant approves, the session reports `transfer_state: ready_for_transfer`.

6. The agent then uses `TronWeb` to build and sign a TRC20 USDT `transfer(address,uint256)` on TRON Nile. The private key stays on the agent side. The merchant never gets wallet custody.

7. After broadcast, the agent submits the tx hash to `POST /ucp/v1/checkout-sessions/:id/complete`. The server verifies the transaction on-chain instead of trusting the client.

8. The server checks the tx succeeded, the contract is correct, the recipient matches `MERCHANT_ADDRESS`, and the amount matches the checkout total. It even decodes the TRC20 calldata to verify the transfer fields.

9. Only after the order becomes `PAID` can the agent retry `GET /api/premium-data` with `Authorization: UCP <txHash>` and unlock the premium payload.

10. The big idea: this repo shows a path to agent commerce with automation plus guardrails. UCP gives the language, TRON moves the money, and human approval plus receipt verification keep the system safe.
