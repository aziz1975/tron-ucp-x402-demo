import hashlib
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from bankofai.x402.facilitator import FacilitatorClient
from bankofai.x402.fastapi import X402Middleware
from bankofai.x402.server import X402Server

load_dotenv()

NETWORK = os.environ.get("X402_NETWORK", "tron:nile")
PAY_TO_ADDRESS = os.environ["MERCHANT_ADDRESS"]
FACILITATOR_URL = os.environ.get("FACILITATOR_URL", "https://facilitator.bankofai.io")
PRICE_DECIMAL = os.environ.get("X402_PRICE_DECIMAL", "15.00")
PRICE_CURRENCY = os.environ.get("X402_PRICE_CURRENCY", "USDT")
SCHEMES = [
    scheme.strip()
    for scheme in os.environ.get("X402_SERVICE_SCHEMES", "exact_permit").split(",")
    if scheme.strip()
]

app = FastAPI(title="TRON x402 Middleware Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

x402_server = X402Server().set_facilitator(FacilitatorClient(FACILITATOR_URL))
x402 = X402Middleware(x402_server)


@app.get("/health")
async def health():
    return {
        "ok": True,
        "network": NETWORK,
        "facilitator": FACILITATOR_URL,
        "price": f"{PRICE_DECIMAL} {PRICE_CURRENCY}",
        "payTo": PAY_TO_ADDRESS,
    }


@app.get("/premium-data")
@x402.protect(
    prices=[f"{PRICE_DECIMAL} {PRICE_CURRENCY}"],
    schemes=SCHEMES,
    network=NETWORK,
    pay_to=PAY_TO_ADDRESS,
)
async def premium_data(request: Request):
    prompt_source = request.query_params.get("q", "premium-data")
    digest = hashlib.sha256(prompt_source.encode("utf-8")).hexdigest()
    return {
        "success": True,
        "data": {
            "confidential_ai_model_weights": "0x8fa9b2...34df",
            "weather_forecast": "72F and sunny in Silicon Valley",
            "alpha_signals": ["LONG $TRX", "SHORT $FIAT"],
            "request_fingerprint": digest,
        },
        "payment_protocol": "bankofai_x402",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "x402_service:app",
        host="0.0.0.0",
        port=int(os.environ.get("X402_SERVICE_PORT", "8001")),
    )
