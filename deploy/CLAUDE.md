# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FS金彩賽車 - A comprehensive online betting platform with three main components:
1. **Main Betting Platform** - Real-time racing lottery game
2. **Agent Management System** - Hierarchical agent/member management with rebates
3. **Lottery Website** - Public-facing Next.js app for displaying results

## Common Development Commands

### Main Application
```bash
# Development
npm run dev              # Start game backend with nodemon (port 3000)
npm run dev:agent        # Start agent backend with nodemon (port 3003)  
npm run dev:all          # Start both backends concurrently

# Production
npm start                # Start game backend
npm run start:agent      # Start agent backend
npm run start:all        # Start both backends

# Database & Testing
npm run fix-db           # Run database fixes
npm run test-db          # Test database queries
node db/init.js          # Initialize database tables
```

### Lottery Website (in lottery-website/ directory)
```bash
npm run dev              # Start Next.js development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

### No Test Commands
The project currently has no test suite configured. The `npm test` command will exit with an error.

## High-Level Architecture

### Service Architecture
The system uses a **microservices-inspired architecture** with two separate backend services:

1. **Game Backend (backend.js)** - Port 3000
   - Handles betting operations and game draws
   - Manages real-time race results and animations
   - Synchronizes with agent system for member data
   - Serves frontend from `frontend/` directory

2. **Agent Backend (agentBackend.js)** - Port 3003
   - Manages agent/member hierarchical structure
   - Handles rebate calculations and distributions
   - Provides win/loss control features
   - Serves agent frontend from `agent/frontend/` directory

### Database Architecture
- **PostgreSQL on Render** - Production database with hardcoded credentials
- **Shared Database** - Both backends use the same database instance
- **Key Tables**:
  - `agents` - Agent hierarchy with parent-child relationships
  - `members` - Players under agents
  - `bet_history` - All betting records
  - `result_history` - Game draw results
  - `transaction_records` - Financial transactions
  - `transfer_records` - Inter-user transfers
  - `win_loss_control` - Agent-specific betting controls

### Security Architecture
- **JWT Authentication** - Token-based auth with 24-hour expiry
- **Session Management** - Single-device enforcement via database-backed sessions
- **Security Middleware Stack**:
  - XSS protection
  - SQL injection prevention
  - CSRF tokens
  - Rate limiting (API: 100/15min, Login: 5/15min)
  - IP filtering capabilities
- **Password Security** - bcrypt hashing with salt rounds

### Critical Integration Points
1. **Agent-Game Synchronization**: Game backend calls agent backend APIs to:
   - Validate member logins
   - Update balances after bets
   - Sync draw results

2. **Rebate System**: Complex hierarchical calculations involving:
   - Parent-child agent relationships
   - Percentage-based distributions
   - Transaction record creation

3. **Settlement System**: Handles bet settlement with:
   - Duplicate prevention mechanisms
   - Transaction integrity checks
   - Balance update synchronization

### Known Issues & Recent Fixes
The codebase has several fix scripts addressing:
- Duplicate bet settlements (`fix-duplicate-settlement.cjs`)
- Balance reconciliation issues (`fix-lala222-balance.cjs`)
- Rebate calculation problems (`fixed-settlement-functions.js`)
- Database constraint issues (`fix-missing-database-functions.sql`)

### Environment Configuration
- **Forced Production Mode** - Database config always uses production settings
- **Render Deployment** - Configured for Render.com platform
- **No Local Database** - No localhost database fallback configured
- **Hardcoded Credentials** - Database credentials are embedded in `db/config.js`

### Important Notes
1. The cache system (Redis) is not implemented - empty files exist but aren't used
2. Database credentials are hardcoded - consider using environment variables
3. Agent API URL is hardcoded to Render deployment
4. The system handles real money - ensure all financial calculations are accurate