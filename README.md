# MintGuard NFT Authenticity Verification on GenLayer

MintGuard is a decentralized NFT authenticity verification application built on [GenLayer](https://docs.genlayer.com/). It uses GenLayer's AI consensus mechanism to detect copies, derivatives, AI-generated fakes, and stolen art patterns.

## How It Works

MintGuard leverages GenLayer's **Optimistic Democracy** consensus:

1. A user submits an artwork (URL, title, creator claim) with a verification fee
2. The `verify_originality` function triggers a **non-deterministic operation** using `gl.vm.run_nondet_unsafe`
3. The **leader validator** fetches the artwork page via `gl.nondet.web.get()`, sends it to an LLM via `gl.nondet.exec_prompt()`, and produces a normalized JSON report
4. Independent **validator nodes** repeat the same analysis with the same normalization logic
5. If validators agree (same `is_original`, same `category`, confidence within ±2), the verdict is recorded on-chain
6. If they disagree, the transaction is **canceled** (not stuck) and the frontend displays a descriptive error

### Validator Robustness

The contract uses a shared `_analyze()` helper function that:
- Issues a strict JSON-only prompt (no free-form text allowed)
- Strips markdown code fences from LLM responses
- Normalizes all fields: `bool()` cast, `int` clamping 1-10, `str.lower().strip()`, category validation
- Both leader and validators use identical normalization, preventing disagreements caused by formatting differences

### Consensus Failure Handling

The frontend properly handles all transaction states:
- `TransactionStatus.ACCEPTED` success, verdict recorded
- `TransactionStatus.CANCELED` consensus failure, descriptive message shown
- Error patterns (timeout, abort) — caught and displayed as user-friendly messages

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (Next.js)                              │
│  - GenLayer JS SDK (genlayer-js)                │
│  - client.connect("testnetBradbury")            │
│  - writeContract / readContract                  │
│  - waitForTransactionReceipt                    │
└──────────────────────┬──────────────────────────┘
                       │ JSON-RPC
┌──────────────────────▼──────────────────────────┐
│  GenLayer Testnet Bradbury                       │
│  - Real AI workloads with powerful LLMs         │
│  - Multiple validator nodes                      │
│  - Optimistic Democracy consensus               │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  MintGuard Intelligent Contract (Python)         │
│  - request_check (payable): stores submission   │
│  - verify_originality: non-det AI consensus     │
│  - get_check / get_check_count: read state      │
└─────────────────────────────────────────────────┘
```

## Project Structure

```
contracts/
  mintguard.py        # GenLayer Intelligent Contract (Python)
  deploy.py           # Deployment instructions
frontend/
  src/app/page.tsx    # Main UI with full error handling
  src/lib/genlayer.ts # GenLayer JS SDK integration
  package.json        # Dependencies (genlayer-js, next, react)
```

## Deployment

### Prerequisites

1. Install [GenLayer CLI](https://docs.genlayer.com/developers/intelligent-contracts/tools/genlayer-cli):
   ```bash
   pip install genlayer
   ```

2. Set network to Testnet Bradbury:
   ```bash
   genlayer network testnet-bradbury
   ```

3. Create an account:
   ```bash
   genlayer account create
   ```

4. Fund from faucet: https://testnet-faucet.genlayer.foundation/

### Deploy the Contract

```bash
genlayer deploy --contract contracts/mintguard.py
```

The CLI will output the contract address. Set it in the frontend:
```bash
# In frontend/.env.local
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedAddress
```

### Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

## Contract API

| Function | Type | Description |
|----------|------|-------------|
| `request_check(image_url, title, creator_claim)` | write (payable) | Submit a work for verification. Requires GEN fee. |
| `verify_originality(check_id)` | write | Trigger AI consensus verification. Non-deterministic. |
| `get_check(check_id)` | view | Read a single check record (JSON string). |
| `get_check_count()` | view | Get total number of submitted works. |

## GenLayer Features Used

- **Non-determinism**: `gl.vm.run_nondet_unsafe()` with custom leader/validator functions
- **Web Access**: `gl.nondet.web.get()` to fetch artwork pages
- **LLM Integration**: `gl.nondet.exec_prompt()` for AI analysis
- **Payable Functions**: `@gl.public.write.payable` for verification fees
- **On-chain Storage**: `TreeMap[str, str]` for permanent authenticity records
- **Custom Validator Logic**: Normalized comparison ensuring consensus stability

## Frontend SDK Usage

The frontend uses the official `genlayer-js` SDK:

```typescript
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

// Create client with wallet
const client = createClient({ chain: testnetBradbury, account: address, provider: window.ethereum });
await client.connect("testnetBradbury");

// Write (triggers AI consensus)
const hash = await client.writeContract({ address, functionName: "verify_originality", args: [checkId] });
const receipt = await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED });

// Read
const data = await client.readContract({ address, functionName: "get_check", args: ["1"] });
```

## Links

- [GenLayer Documentation](https://docs.genlayer.com/)
- [GenLayer Testnet Faucet](https://testnet-faucet.genlayer.foundation/)
- [Non-determinism Guide](https://docs.genlayer.com/developers/intelligent-contracts/features/non-determinism)
- [Writing Data to Contracts](https://docs.genlayer.com/developers/decentralized-applications/writing-data)
