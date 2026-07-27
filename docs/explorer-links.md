# Transaction Explorer Links

Transaction rows render a Stellar Expert link when the transaction data includes
a real Stellar transaction hash.

The row helper checks `txHash`, then `hash`, then `id`. Values must be
64-character hexadecimal hashes, so mock ids such as `TXN-001` and `txn-001`
do not produce external links.

Links use the connected wallet network:

- `PUBLIC` opens `https://stellar.expert/explorer/public/tx/<hash>`.
- `TESTNET` opens `https://stellar.expert/explorer/testnet/tx/<hash>`.

Explorer links open in a new tab with `rel="noopener noreferrer"` and a
descriptive accessible label.
