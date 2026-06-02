# Stellarlend

**Fast & Secure DeFi Lending on Stellar**

Stellarlend is a decentralized finance (DeFi) lending platform built on the Stellar blockchain. It enables users to borrow and lend digital assets with ultra-low fees, instant settlements, and full transparency—powered by Soroban smart contracts. The platform is designed for both crypto-native users and those new to DeFi, offering an intuitive interface for managing lending and borrowing operations on one of the most efficient blockchain networks.

This frontend application provides a modern, responsive web interface for interacting with the Stellarlend protocol, featuring real-time transaction tracking, interest rate calculations, and comprehensive dashboard analytics.

## 🚀 Features

- **Lending & Borrowing**: Earn interest by lending assets or borrow against collateral
- **Multi-Asset Support**: Support for XLM, USDC, BTC, ETH, and other Stellar-based assets
- **Real-Time Asset Pricing**: Cached price oracle proxy for secure price feeds
- **Real-Time Calculations**: Dynamic interest rate and payment calculations
- **Transaction Management**: Track all lending, borrowing, and payment transactions
- **Dashboard Analytics**: Comprehensive metrics and insights
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Component Library**: Built with Storybook for component development and documentation

## 📋 Requirements

- **Node.js**: v18.0.0 or higher
- **Package Manager**: npm, yarn, pnpm, or bun
- **Git**: For version control

## 🛠️ Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Stellarlend-frontend
```

### 2. Install Dependencies

Choose your preferred package manager:

```bash
# Using npm
npm install

# Using yarn
yarn install

# Using pnpm (recommended)
pnpm install

# Using bun
bun install
```

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Stellar Network Configuration
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_HORIZON_URLS=https://horizon-testnet.stellar.org,https://horizon-backup.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_CONTRACT_ID=GXXXXXXXXXXXXXXX...YOUR_CONTRACT_ID
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# API Configuration (if applicable)
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=false

# Server Logging Configuration
SERVER_LOG_LEVEL=info

# Transaction Rate Limiting
API_RATE_LIMIT_MAX=100
API_RATE_LIMIT_WINDOW_MS=60000
TX_ACCOUNT_RATE_LIMIT_MAX=30
TX_ACCOUNT_RATE_LIMIT_WINDOW_MS=60000
TX_ACCOUNT_RATE_LIMIT_BURST=60
```

The Tx relay routes `/api/tx/build` and `/api/tx/submit` are protected by an account-scoped wallet limit. If a wallet exceeds the configured burst or window, the response returns `429` with `Retry-After` and standard `RateLimit-*` headers.

Migration note: if you previously used `NEXT_PUBLIC_SOROBAN_RPC_URL`, rename it to `SOROBAN_RPC_URL` and restart the dev server or rebuild your deployment. The RPC endpoint now stays server-only so browsers cannot bypass the relay and its rate limits.

Logging is emitted as structured JSON by `lib/logger.ts` and includes:
- `timestamp`
- `level`
- `route`
- `method`
- `status`
- `durationMs`
- `message`
- `context`

Sensitive information such as authorization headers, API keys, auth tokens, and Stellar public/secret keys are redacted automatically.

> **Note**: For production, use the Stellar mainnet configuration and secure your environment variables.

### 4. Run the Development Server

```bash
# Using npm
npm run dev

# Using yarn
yarn dev

# Using pnpm
pnpm dev

# Using bun
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### 5. Database Setup (Drizzle ORM & PostgreSQL)

Stellarlend uses **Drizzle ORM** with a **PostgreSQL** database backend to persist accounts, sessions, notifications, transactions, and audit logs.

1. Ensure your `.env.local` contains the database connection URL:
   ```env
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/stellarlend
   ```

2. Run the migrations to initialize your local database:
   ```bash
   # Using npm
   npm run db:migrate

   # Using pnpm
   pnpm db:migrate
   ```

### 6. Build for Production

```bash
npm run build
npm start
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Component Testing with Storybook

```bash
# Start Storybook development server
npm run storybook

# Build Storybook for static hosting
npm run build-storybook
```

Storybook will be available at [http://localhost:6006](http://localhost:6006)

## 📁 Project Structure

```
Stellarlend-frontend/
├── app/                      # Next.js App Router pages
│   ├── account/             # User account pages
│   ├── dashboard/           # Dashboard pages
│   ├── lending/             # Lending & borrowing pages
│   └── layout.tsx           # Root layout
├── components/              # React components
│   ├── atoms/              # Atomic design: smallest components
│   ├── molecules/          # Composite components
│   ├── organisms/          # Complex components
│   ├── features/           # Feature-specific components
│   │   ├── account/        # Account feature components
│   │   ├── dashboard/      # Dashboard feature components
│   │   └── lending/        # Lending feature components
│   ├── marketing/          # Marketing page components
│   └── shared/             # Shared components
│       ├── ui/             # UI components (buttons, icons, etc.)
│       ├── layout/         # Layout components (navbar, sidebar, etc.)
│       └── common/         # Common utility components
├── constants/              # Application constants
│   └── design-tokens.ts   # Design system tokens
├── context/               # React context providers
│   └── SidebarContext.tsx
├── lib/                   # Utility libraries
│   ├── auth.ts            # Authentication utilities
│   ├── utils/             # Utility functions
│   │   ├── cn.ts          # Class name utilities (Tailwind merge)
│   │   └── index.ts       # Utils barrel export
│   └── index.ts           # Lib barrel export
├── types/                 # TypeScript type definitions
│   ├── Transaction.ts     # Transaction-related types
│   ├── common.ts          # Common utility types
│   └── index.ts           # Types barrel export
├── public/                # Static assets
│   ├── icons/             # Icon assets
│   └── images/            # Image assets
├── scripts/               # Build and utility scripts
│   ├── svgToComponent.js  # SVG to React component converter
│   └── generate-component.js
├── test/                 # Test utilities and helpers
│   ├── test-utils.tsx
│   └── component-helpers.ts
└── stories/              # Storybook stories
```

## 🎨 Component Development

### Generate New Components

We use [Plop](https://plopjs.com/) for component scaffolding:

```bash
npm run generate-component
```

Follow the prompts to create a new component with proper structure, tests, and Storybook stories.

### Convert SVG to React Components

Place SVG files in `public/images` and run:

```bash
npm run svg
```

This will automatically convert SVGs to React components in `components/shared/ui/icons/`.

## 🗄️ Backend & API

The server-side API surface is documented in two places:

| Resource | Description |
|---|---|
| [`docs/backend-architecture.md`](docs/backend-architecture.md) | Architecture overview — lib/ modules, caching model, security, and how to add a new route |
| [`openapi.yaml`](openapi.yaml) | OpenAPI 3.1 spec for all `app/api/*` routes, params, and response shapes |

### Available API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Platform & Stellar network health |
| `POST/GET/DELETE` | `/api/auth/session` | — | Session lifecycle |
| `GET` | `/api/prices` | Public | Asset spot prices (cached 5 s) |
| `GET` | `/api/markets` | Public | Per-asset supply/borrow APR & utilization (cached 30 s) |
| `GET` | `/api/positions` | Optional | User lending/borrowing positions |
| `GET/POST` | `/api/transactions` | Public | Transaction history and creation |
| `GET` | `/api/transactions/export` | Public | Transactions CSV export |
| `POST` | `/api/quote` | Public | Lending/borrowing quote calculation |
| `GET` | `/api/notifications` | Required | List in-app notifications |
| `PATCH` | `/api/notifications/:id` | Required | Mark notification as read |

## 🔗 Helpful Links

### Documentation
- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- [React Documentation](https://react.dev) - React library documentation
- [TypeScript Documentation](https://www.typescriptlang.org/docs/) - TypeScript language reference
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) - Utility-first CSS framework
- [Stellar Documentation](https://developers.stellar.org/docs) - Stellar blockchain development guide
- [Soroban Documentation](https://soroban.stellar.org/docs) - Soroban smart contracts
- [Idempotency contract and key lifetime](docs/idempotency.md) - API replay protection and cache retention guidance

### Development Tools
- [Storybook](https://storybook.js.org/docs) - Component development environment
- [Vitest](https://vitest.dev) - Fast unit test framework
- [Playwright](https://playwright.dev) - End-to-end testing framework

### Design & Styling
- [Framer Motion](https://www.framer.com/motion/) - Animation library
- [Lucide Icons](https://lucide.dev) - Icon library

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for detailed guidelines.

**Quick Start:**
1. **Fork the repository** and create a feature branch
2. **Follow the code style** - We use ESLint and Prettier (configured with Husky pre-commit hooks)
3. **Write tests** for new features and bug fixes
4. **Update documentation** as needed
5. **Submit a pull request** with a clear description of changes

### Code Style

- **Linting**: Run `npm run lint` before committing
- **Formatting**: Prettier is configured to run automatically on commit
- **TypeScript**: Strict mode enabled - ensure all types are properly defined

### Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/). Examples:
- `feat: add new lending form component`
- `fix: resolve transaction status display issue`
- `docs: update README with setup instructions`

For more details, see [CONTRIBUTING.md](CONTRIBUTING.md).

## 🚢 Deployment

### Vercel (Recommended)

The easiest way to deploy is using [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import the repository in Vercel
3. Configure environment variables
4. Deploy!

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

For more deployment options, see the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).

## 📝 Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests with Vitest |
| `npm run storybook` | Start Storybook |
| `npm run build-storybook` | Build Storybook for static hosting |
| `npm run svg` | Convert SVG files to React components |
| `npm run generate-component` | Generate new component scaffold |

## 🔒 Security

- Never commit `.env.local` or any files containing secrets
- Use environment variables for all sensitive configuration
- Regularly update dependencies to patch security vulnerabilities
- Review and audit smart contract interactions before production use

## 📄 License

[Add your license information here]

## 🙋 Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Contact the development team
- Check the documentation links above

---

**Built with ❤️ for the Stellar ecosystem**
