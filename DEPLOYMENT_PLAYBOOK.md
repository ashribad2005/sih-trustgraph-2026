# TrustGraph 2026: Deployment Playbook

## 1. Backend (Django + ML Engine) Deployment
**Target Environment:** Render, AWS ECS, or DigitalOcean App Platform

The backend includes memory-intensive data science libraries (`scikit-learn`, `networkx`, `pandas`). Memory management is critical.

### Build & Deploy
1. **Docker Build:** Uses a multi-stage `Dockerfile` (already provided in `backend/Dockerfile`) to compile C-extensions safely and keep the runtime image lean.
2. **Memory Considerations:** The Dockerfile explicitly sets `MALLOC_ARENA_MAX=2` to prevent memory fragmentation and limits Gunicorn to 2 workers to avoid exceeding memory limits on 2GB-4GB instances.
3. **Environment Variables Needed on Production:**
   - `SECRET_KEY`: Long, random string; this variable is required and has no production fallback.
   - `DEBUG`: `False`
   - `ALLOWED_HOSTS`: `<your-production-domain>`
   - `CORS_ALLOWED_ORIGINS`: `<your-frontend-domain>`
   - `DATABASE_URL`: Managed PostgreSQL URL.
   - `WEB3_RPC_URL`: Polygon Amoy RPC endpoint; `RPC_URL` remains accepted for compatibility.
   - `WALLET_PRIVATE_KEY`: **CRITICAL** Inject this securely. Do NOT hardcode.
   - `CONTRACT_ADDRESS`: The deployed Audit Contract address.

## 2. Frontend (React/Vite) Deployment
**Target Environment:** Vercel, Netlify, or AWS Amplify

### Build Commands
1. **Framework Preset:** Vite
2. **Build Command:** `npm run build`
3. **Output Directory:** `dist`

### Environment Variables
Inject the following variable in the Vercel/Netlify dashboard:
- `VITE_API_BASE_URL`: `https://<your-backend-production-domain>.com/api/v1`

## 3. Smart Contract Deployment Checklist
- [ ] **RPC Node:** Obtain an RPC URL for Polygon Amoy (e.g., via Alchemy).
- [ ] **Wallet:** Generate a fresh deployment wallet. Transfer enough MATIC for gas fees.
- [ ] **Deployment:** Run `npx hardhat run contracts/deploy_audit.js --network polygonAmoy`.
- [ ] **Verification:** Securely copy the deployed contract address.
- [ ] **Secrets Security:** Ensure `WALLET_PRIVATE_KEY` and `RPC_URL` are added **only** to the Backend's secure secret manager (e.g., AWS Secrets Manager, Render Environment Variables). They must **never** be added to the Frontend's `.env` or Git repository.
