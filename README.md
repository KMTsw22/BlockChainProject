# Social Wallet — Blockchain Wallet with Social Login

A full-stack Web3 wallet that lets users sign in with a Google account and immediately receive an Ethereum wallet, an ERC-20 reward token balance, and on-chain staking — no seed phrases, no browser extensions, no prior crypto knowledge required.

The goal of the project was to remove the biggest onboarding friction in Web3 (key management) while keeping custody of funds transparent: wallets are derived deterministically from the user's credentials, and all token actions settle on the Ethereum Sepolia testnet through a custom ERC-20 contract I wrote and deployed.

**Scope at a glance:** ~900 lines of FastAPI backend, ~300 lines of Solidity across two contract versions, a 5-page React frontend (Login / Dashboard / Wallet / Settings / Public Wallets) with dedicated auth and wallet contexts, and MongoDB collections for users, wallets, and transaction history.

## Tech Stack

| Layer | Stack |
| --- | --- |
| Smart Contract | Solidity `^0.8.0`, OpenZeppelin (`ERC20`, `Ownable`, `ERC2771Context`), deployed to Ethereum Sepolia |
| Backend | FastAPI (Python), `web3.py`, PyJWT, Google OAuth 2.0, MongoDB (via `pymongo` / `motor`) |
| Frontend | React 18, Material UI 5, `web3.js` v4, React Router v6, Context API for auth/wallet state |
| Infra | Render (backend + frontend), MongoDB Atlas, Infura RPC for Sepolia |

## Key Features

- **Google OAuth 2.0 login** — Authorization-code flow on the backend; ID token is verified with Google's public keys, then exchanged for a short-lived JWT ([backend/index.py](BlockChainProject/backend/index.py#L614-L712)).
- **Deterministic wallet derivation** — On first login a wallet is derived from the user's social ID via `SHA-256`, and on password-based recovery it is rebuilt via `keccak256(social_id ∥ password)`, so a returning user never needs to store a private key locally ([backend/index.py](BlockChainProject/backend/index.py#L192-L205)).
- **One wallet per identity** — The backend enforces a single wallet per social ID at creation time, so password recovery always resolves to the same on-chain address ([backend/index.py](BlockChainProject/backend/index.py#L714-L780)).
- **Signed transaction relay** — For token transfers, the frontend signs the transaction locally with `web3.js`, and the backend verifies the recovered sender with `w3.eth.account.recover_transaction` before broadcasting, so the private key never touches the server ([backend/index.py](BlockChainProject/backend/index.py#L248-L352)).
- **Automatic gas top-up** — If the user's wallet has insufficient ETH to pay gas, a project-owned funding wallet sends just enough Sepolia ETH before the transfer is broadcast, giving a gas-less UX without requiring a full EIP-2771 forwarder.
- **On-chain staking & rewards** — Users can stake ART tokens and claim accrued rewards; the backend builds, signs, and submits the `stake()` / `claimRewards()` calls on the user's behalf against the deployed contract.
- **Welcome bonus airdrop** — New users receive 100 ART (10,000 in V2) via a one-shot `mintTo` from the project wallet, gated both by a `welcome_bonus_given` flag in MongoDB and by an on-chain `hasReceivedWelcomeBonus` mapping so the airdrop stays idempotent even if the off-chain DB is wiped.
- **Public wallets directory** — Users can opt in to making their address discoverable via `GET /public/wallets`, backed by a per-user `show_wallet_public` toggle in the settings endpoint.
- **Transaction history** — Every relayed transfer, stake, claim, and airdrop is persisted to a MongoDB `transactions` collection so users can audit their own activity independently of the chain explorer.

## Smart Contract — `AdvancedRewardToken`

The wallet is backed by a custom ERC-20 I wrote in Solidity. Two versions live in the repo:

- [AdvancedRewardToken.sol](BlockChainProject/AdvancedRewardToken.sol) — the baseline ERC-20 with staking, annual reward accrual, and a capped max supply (`100,000,000 * 10^5`, 5 decimals).
- [AdvancedRewardTokenV2.sol](BlockChainProject/AdvancedRewardTokenV2.sol) — adds **EIP-2771 meta-transactions** via OpenZeppelin's `ERC2771Context`, so a trusted forwarder can pay gas on behalf of users. This is the upgrade path away from the backend gas top-up workaround above.

Contract highlights:

- `stake(amount)` / `claimRewards()` with a configurable reward rate (default 10% APY), per-user `StakeInfo`, and a lockup period.
- `WELCOME_BONUS` tracked on-chain per address (`hasReceivedWelcomeBonus`) to make airdrops idempotent even if the off-chain DB is wiped.
- Events for every state transition (`Staked`, `Unstaked`, `RewardsClaimed`, `WelcomeBonusReceived`) to keep an auditable on-chain trail.

## Architecture

```
  ┌────────────┐     Google OAuth      ┌──────────────┐
  │   React    │──────────────────────▶│   FastAPI    │
  │  (MUI +    │◀────  JWT  ──────────│   backend    │
  │  web3.js)  │                      └──────┬───────┘
  └─────┬──────┘                             │
        │   signed tx (local key)            │ web3.py
        └────────────────────────────────────┤
                                             ▼
                                      ┌──────────────┐
                                      │  Sepolia +   │
                                      │ ART contract │
                                      └──────┬───────┘
                                             │
                                      ┌──────▼───────┐
                                      │  MongoDB     │
                                      │ (users, tx)  │
                                      └──────────────┘
```

The split was deliberate: **signing stays on the client, broadcasting and bookkeeping stay on the server.** The backend never sees a user private key after initial wallet derivation, and the frontend never needs direct RPC access to Sepolia.

## REST API (selected)

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/google/callback` | Exchange a Google authorization code for a short-lived JWT |
| `POST` | `/auth/password` | Password-based login / wallet recovery, enforces one wallet per social ID |
| `GET` | `/wallet/info` | Return the user's wallet address and profile |
| `GET` | `/wallet/balance` | Read ERC-20 balance + stake info directly from the contract |
| `POST` | `/wallet/transfer` | Verify a client-signed transaction and broadcast it, funding gas if needed |
| `POST` | `/wallet/stake` | Build, sign, and send `stake(amount)` on the user's behalf |
| `POST` | `/wallet/claim-rewards` | Build, sign, and send `claimRewards()` on the user's behalf |
| `POST` | `/wallet/welcome-bonus` | One-shot ART airdrop to a newly created wallet (idempotent on-chain and off-chain) |
| `GET` / `PUT` | `/user/settings` | Read and update user preferences (e.g. `show_wallet_public`) |
| `GET` | `/public/wallets` | List opted-in public wallets |

## Project Structure

```
BlockChainProject/
├── AdvancedRewardToken.sol       # v1 ERC-20 + staking
├── AdvancedRewardTokenV2.sol     # v2 adds EIP-2771 meta-tx support
├── backend/
│   ├── index.py                  # FastAPI app (auth, wallet, tx relay)
│   ├── database.py               # MongoDB connection
│   ├── models.py                 # Pydantic / domain models
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── contexts/             # AuthContext, WalletContext (web3.js)
    │   ├── pages/                # Login, Dashboard, Wallet, Settings, PublicWallets
    │   └── App.js
    └── package.json
```

## What I Learned

- **Key custody tradeoffs.** Deterministic derivation is a great onboarding story, but it ties wallet recovery to account recovery — so the password is effectively a private key and has to be handled like one.
- **Gas UX is the real blocker.** The ad-hoc gas top-up works, but writing V2 with `ERC2771Context` made it clear why the ecosystem settled on meta-transactions: the contract itself needs to know the original `_msgSender()`, not just the relayer.
- **Never broadcast what you can't verify.** Recovering the sender from a signed transaction before relaying it was the single most important line of backend code — without it, a JWT alone would have been enough to spend someone else's tokens.

## Notes

- The deployment targets **Sepolia** only. Do not point this at mainnet.
- Environment variables expected by the backend: `SECRET_KEY`, `WEB3_PROVIDER`, `CONTRACT_ADDRESS`, `PROJECT_WALLET_ADDRESS`, `PROJECT_PRIVATE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`, and a MongoDB connection string.
