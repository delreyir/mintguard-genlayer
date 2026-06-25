# 🖼️ MintGuard

**Is that NFT real? AI consensus knows.**

🔗 **Live app:** https://mintguard.pages.dev
📜 **Contract (GenLayer Studionet):** `0x0c66f72411a3E48E0afA95546D01428303145d84`

---

## The Problem

NFT and digital-art marketplaces are flooded with copies, stolen art, and undisclosed AI-generated pieces. Buyers have no neutral way to check whether a work is genuinely original before paying. Centralized "verification" badges are opaque and easy to game.

MintGuard is an authenticity registry where an independent panel of AI examiners inspects each work and records a permanent, on-chain verdict.

---

## How It Works

1. **Connect your wallet** (MetaMask, Rabby, or any EVM wallet — no Snap required)
2. **Submit a work** — its URL, title, the claimed creator, plus a small appraisal fee.
3. **Convene the AI panel** — validators fetch the content and analyze it for originality.
4. **Get an on-chain verdict** — original / derivative / copy / AI-generated / suspicious, with a confidence score and reasoning. Stored forever.

---

## Use Cases

- Buyers verifying an NFT before purchase
- Marketplaces filtering stolen or copied art
- Creators proving their work is original
- Collectors building a registry of verified pieces

---

## Why GenLayer?

Verifying originality needs two things a normal blockchain can't do: **fetch live web content** and **make a judgment** about it. GenLayer validators do both — each fetches the work and classifies it independently, and they must agree on the verdict and confidence (±2) before it's written on-chain. No single examiner's bias decides the outcome.

---

## Wallet & Network

Connects a standard EVM wallet and signs through the normal wallet popup — **no GenLayer Snap**. On connect it adds/switches to the **GenLayer Studio Network** (chain `61999`, RPC `https://studio.genlayer.com/api`).

---

## Contract API

| Method | Type | Description |
|--------|------|-------------|
| `request_check(image_url, title, creator_claim)` | payable | Submit a work with the appraisal fee |
| `verify_originality(check_id)` | write (AI) | Convene the AI panel to examine it |
| `get_check(check_id)` | view | Get a check's full result |
| `get_check_count()` | view | Total works submitted |

**Consensus rule:** `is_original` and `category` must match exactly; `confidence` within ±2.

---

## Project Structure

```
mintguard-genlayer/
├── contracts/
│   └── mintguard.py         # GenLayer Intelligent Contract (Python)
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx     # Museum-gallery UI
│   │   └── lib/
│   │       └── genlayer.ts  # Wallet connect (no Snap) + read client
│   ├── next.config.js
│   └── package.json
└── README.md
```

---

## Run Locally

```bash
npm install -g genlayer
genlayer network set studionet
genlayer account create --name deployer --password "yourpass"
genlayer account unlock --password "yourpass"
genlayer deploy --contract contracts/mintguard.py

cd frontend
npm install
npm run dev
```

---

## How Verification Works (under the hood)

```
request_check(url, title, creator)  →  verify_originality(id)
                                              │
                          ┌───────────────────┴───────────────────┐
                          │  LEADER + VALIDATORS (independent)     │
                          │  • fetch the work via gl.nondet.web    │
                          │  • classify originality + confidence   │
                          │  • must agree (category + ±2)          │
                          └───────────────────┬───────────────────┘
                                              ▼
                          On-chain verdict: authentic / copy / AI-gen …
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart contract | Python — GenLayer Intelligent Contract |
| Web access | `gl.nondet.web.get()` |
| AI consensus | `gl.vm.run_nondet_unsafe` |
| Frontend | Next.js (static export) + TypeScript |
| SDK | genlayer-js |
| Hosting | Cloudflare Pages |

---

## License

MIT
