# PingPay

**PingPay is an AI-powered money app on Arbitrum that turns conversations into transactions.**

PingPay turns natural language into on-chain actions. PAY people instantly, SWEEP idle stables into yield, and INVEST into Bitcoin or Stocks — all from chat. Our first product, "PAY," allows anyone to send USDC to any type of identifier, like WhatsApp, Email ID or a Telegram handle. The receiver **does not need PingPay** or a **crypto wallet**.

## 🚀 Features

- **Chat Command Interface**: Type natural commands like `send 20 usdc to @alice`
- **One-Click Claims**: Recipients get a Telegram message with a claim link
- **No Wallet Required**: Recipients can claim without having a crypto wallet
- **Real-time Status**: Track transactions with ✅ (confirmed) and ✅✅ (claimed) indicators
- **Mobile-First Design**: iOS-optimized PWA-ready interface

## 🏗️ Architecture

```
PingPay/
├── backend/          # Node.js/Express API server
│   ├── src/
│   │   ├── index.js          # Express app entry
│   │   ├── database.js       # SQLite database
│   │   ├── services/
│   │   │   ├── blockchain.js # Ethers.js USDC transfers
│   │   │   └── telegram.js   # Telegram bot notifications
│   │   └── routes/
│   │       ├── transfers.js  # Send/parse commands
│   │       ├── wallets.js    # Wallet management
│   │       └── claims.js     # Claim verification
│   └── data/                 # SQLite database file
│
└── frontend/         # React + Vite + TailwindCSS
    ├── src/
    │   ├── pages/
    │   │   ├── HomePage.jsx    # Main chat interface
    │   │   ├── ClaimPage.jsx   # Recipient claim flow
    │   │   └── HistoryPage.jsx # Transaction history
    │   ├── components/
    │   │   ├── ConfirmModal.jsx
    │   │   └── AddFundsModal.jsx
    │   └── context/
    │       └── WalletContext.jsx
    └── public/
```

## 📦 Tech Stack

**Backend:**

- Node.js + Express
- SQLite (simple file-based DB)
- Ethers.js v6 (blockchain interactions)
- node-telegram-bot-api

**Frontend:**

- React 18
- Vite
- TailwindCSS
- React Router
- Lucide Icons

**Blockchain:**

- Arbitrum Sepolia (testnet)
- USDC ERC-20 transfers

## 🛠️ Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Telegram Bot Token (from @BotFather)
- Arbitrum Sepolia wallet with ETH for gas

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values:
# - TELEGRAM_BOT_TOKEN
# - DEMO_WALLET_PRIVATE_KEY

# Create data directory
mkdir -p data

# Start server
npm run dev
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The app will be available at `http://localhost:5173`

## 🔑 Environment Variables

### Backend (.env)

```env
PORT=3001
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
USDC_CONTRACT_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
CHAIN_ID=421614
DEMO_WALLET_PRIVATE_KEY=your_private_key
FRONTEND_URL=http://localhost:5173
```

## 📱 User Flows

### Flow A: Send USDC

1. Open PingPay web app
2. Type: `send 20 usdc to @alice`
3. Review confirmation modal → **Confirm & Send**
4. Transaction broadcasts → shows ✅ when confirmed
5. Recipient gets Telegram notification with claim link

### Flow B: Claim USDC

1. Recipient receives Telegram message with link
2. Opens claim page → sees "You received 20 USDC"
3. Enters Telegram handle → clicks **Claim**
4. Sees balance + options (Send, Withdraw, Earn)
5. Sender's UI updates to ✅✅

## 🧪 Testing

### Get Testnet USDC

1. Visit [Circle Faucet](https://faucet.circle.com/)
2. Select Arbitrum Sepolia
3. Enter your wallet address
4. Receive testnet USDC

### Get Testnet ETH (for gas)

1. Visit [Arbitrum Sepolia Faucet](https://www.alchemy.com/faucets/arbitrum-sepolia)
2. Enter your wallet address

## 📊 API Endpoints

### Transfers

- `POST /api/transfers/parse` - Parse send command
- `POST /api/transfers/estimate` - Get gas estimate
- `POST /api/transfers/send` - Execute transfer
- `GET /api/transfers/:id` - Get transfer details
- `GET /api/transfers/history/:address` - Get transfer history

### Wallets

- `GET /api/wallets/demo` - Get demo wallet info
- `GET /api/wallets/balance/:address` - Get balances
- `GET /api/wallets/handle/:handle` - Get wallet by Telegram handle
- `POST /api/wallets/create` - Create wallet for handle

### Claims

- `GET /api/claims/:token` - Get claim info
- `POST /api/claims/:token/verify` - Verify and claim

## 🎯 Demo Mode

The app runs in demo mode with a prefunded wallet. For production:

- Implement proper wallet authentication
- Add recovery mechanisms for recipient wallets
- Integrate proper Telegram chat ID storage
- Add rate limiting and security measures

## 📄 License

MIT
