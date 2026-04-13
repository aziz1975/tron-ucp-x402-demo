const { TronWeb } = require('tronweb');
require('dotenv').config();

const tronWeb = new TronWeb({
    fullNode: 'https://nile.trongrid.io',
    solidityNode: 'https://nile.trongrid.io',
    eventServer: 'https://nile.trongrid.io',
    privateKey: process.env.TRON_PRIVATE_KEY
});

async function check() {
    try {
        const address = tronWeb.defaultAddress.base58;
        console.log("Agent Wallet Address:", address);
        
        const trx = await tronWeb.trx.getBalance(address);
        console.log("TRX Balance:", trx / 1_000_000);
        
        const contract = await tronWeb.contract().at('TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf');
        const usdt = await contract.balanceOf(address).call();
        
        console.log("USDT Balance (Nile TRC20):", usdt.toString() / 1_000_000);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

check();
