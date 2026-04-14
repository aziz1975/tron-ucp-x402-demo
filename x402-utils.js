const { randomBytes } = require('crypto');

const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED';
const PAYMENT_SIGNATURE_HEADER = 'PAYMENT-SIGNATURE';
const PAYMENT_RESPONSE_HEADER = 'PAYMENT-RESPONSE';

let x402ModulePromise = null;

const getX402Module = () => {
    if (!x402ModulePromise) {
        x402ModulePromise = import('@bankofai/x402');
    }
    return x402ModulePromise;
};

const createPaymentPermitContext = (validitySeconds) => {
    const now = Math.floor(Date.now() / 1000);
    return {
        meta: {
            kind: 'PAYMENT_ONLY',
            paymentId: `0x${randomBytes(16).toString('hex')}`,
            nonce: BigInt(`0x${randomBytes(8).toString('hex')}`).toString(),
            validAfter: now,
            validBefore: now + validitySeconds
        }
    };
};

module.exports = {
    PAYMENT_REQUIRED_HEADER,
    PAYMENT_SIGNATURE_HEADER,
    PAYMENT_RESPONSE_HEADER,
    getX402Module,
    createPaymentPermitContext
};
