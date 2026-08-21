# TrustGraph 2026 — Deployment Checklist

> Quick-reference checklist for deploying to your target environment

---

## 🎯 Pre-Deployment (Do Once)

### 1. Smart Contract Deployment (Polygon Amoy)
```bash
# In project root
npm install
npx hardhat compile
npx hardhat run contracts/deploy_audit.js --network polygonAmoy
# → Copy CONTRACT_ADDRESS to .env.prod
# → Fund wallet with MATIC from https://faucet.polygon.technology/
```

### 2. GitHub Repository
- [ ] Push `phase-3-4-deployment` branch ✅ (done)
- [ ] Create PR → Review → Merge to `main`
- [ ] Verify GitHub Actions pass (if configured)

---

## 🚀 Option A: Render (Recommended)

### Backend Setup
1. **Dashboard** → New → Blueprint → Connect `ashribad2005/sih-trustgraph-2026`
2. **Render auto-creates**: PostgreSQL + Web Service
3. **Set Secret Variables** (Environment → Secret Variables):
   - `WALLET_PRIVATE_KEY` = `0x...` (service wallet)
   - `CONTRACT_ADDRESS` = `0x...` (from step 1)
   - `POLYGONSCAN_API_KEY` = (optional)
   - `GEMINI_API_KEY` = (optional)
4. **Deploy** → Wait for build + deploy

### Frontend Setup
1. **Dashboard** → New → Static Site → Connect same repo
2. **Settings**:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Publish Directory: `dist`
3. **Environment Variable**:
   - `VITE_API_BASE_URL` = `https://trustgraph-api.onrender.com/api/v1`
4. **Rewrite Rule** (Settings → Redirects/Rewrites):
   - Source: `/*` → Destination: `/index.html` (Type: Rewrite)

### Verify
- [ ] Backend health: `https://trustgraph-api.onrender.com/api/v1/health/`
- [ ] Frontend loads: `https://trustgraph-frontend.onrender.com`
- [ ] Login works with superuser credentials

---

## 🐳 Option B: Docker (Self-Hosted / VPS)

### Prerequisites
- Docker + Docker Compose installed
- Domain with DNS pointing to server
- SSL certs (Let's Encrypt via Caddy/Traefik/nginx)

### Deploy
```bash
# 1. Clone & configure
git clone https://github.com/ashribad2005/sih-trustgraph-2026.git
cd sih-trustgraph-2026
cp .env.prod.example .env.prod
# Edit .env.prod with ALL production values

# 2. Deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d

# 3. Initialize DB (container startup runs this idempotently)
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_data

# 4. Configure Reverse Proxy (Caddy example)
# Caddyfile:
# yourdomain.com {
#     reverse_proxy frontend:80
# }
# api.yourdomain.com {
#     reverse_proxy backend:8000
# }
```

### Verify
- [ ] `curl https://api.yourdomain.com/api/v1/health/`
- [ ] Frontend accessible at `https://yourdomain.com`
- [ ] Blockchain anchoring works (ingest test tx)

---

## 💻 Option C: Local Development (No Docker)

### Backend (SQLite fallback)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set SECRET_KEY in the repository-level .env; leave DATABASE_URL empty for SQLite.
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_data
python manage.py runserver
# → http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Test Pipeline
```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}' | jq -r .access)

# Ingest test transaction (should create case + anchor)
curl -X POST http://localhost:8000/api/v1/transactions/ingest/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tx_id": "TXN-TEST-001",
    "timestamp": "2026-01-15T14:30:00Z",
    "sender_account": "ACC-SENDER-42",
    "receiver_account": "ACC-RECEIVER-99",
    "amount": "150000.00",
    "device_id": "DEV-SHARED-001",
    "channel": "UPI",
    "account_age_days": 3
  }'

# Verify case created
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/cases/

# Verify blockchain integrity
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/cases/TG-2026-00001/verify-integrity/
```

---

## ✅ Post-Deployment Verification Checklist

| Check | Command / Action | Expected |
|-------|------------------|----------|
| Backend health | `curl /api/v1/health/` | `200 OK` |
| Auth works | Login via frontend | JWT token returned |
| Case list | `GET /api/v1/cases/` | Paginated response with `results` |
| Graph data | `GET /api/v1/cases/{id}/` | `graph_data` present |
| Dashboard metrics | `GET /api/v1/dashboard/metrics/` | KPIs with correct field names |
| Blockchain anchor | Ingest high-risk tx | `anchor_tx_hash` in case |
| Integrity verify | `GET /api/v1/cases/{id}/verify-integrity/` | `is_tampered: false` or `verdict: LOCAL_VERIFIED` |
| Frontend loads | Open in browser | Dashboard renders |
| Graph renders | Click case → Graph tab | Cytoscape graph visible |

---

## 🔐 Secrets Reference (Never Commit!)

| Secret | Where | Source |
|--------|-------|--------|
| `WALLET_PRIVATE_KEY` | Backend only | New wallet + MATIC faucet |
| `CONTRACT_ADDRESS` | Backend only | `npx hardhat run deploy_audit.js` |
| `DATABASE_URL` | Backend only | Managed PostgreSQL provider |
| `SECRET_KEY` | Backend only | `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())" |
| `GEMINI_API_KEY` | Backend only | https://aistudio.google.com/apikey |
| `POLYGONSCAN_API_KEY` | Backend only | https://polygonscan.com/apis |
| `VITE_API_BASE_URL` | Frontend build | Your backend URL |

---

## 🛠 Troubleshooting Quick Fixes

| Issue | Fix |
|-------|-----|
| Backend OOM | Reduce workers: `--workers 1 --threads 2` |
| Frontend blank | Add SPA rewrite rule (`/*` → `/index.html`) |
| CORS error | Set `CORS_ALLOWED_ORIGINS` to exact frontend domain |
| Blockchain fail | Check wallet has MATIC, correct chain ID (80002) |
| ML slow | Ensure 4GB+ RAM, `MALLOC_ARENA_MAX=2` |
| Migration fail | Inspect the migration error and database connection; do not use `--fake` in production without an explicit recovery plan |

---

## 📞 Support

- **Render Blueprint**: `render.yaml` in repo root
- **Docker Compose**: `docker-compose.prod.yml` + `.env.prod`
- **Local Dev**: `docker compose up` (dev) or manual commands above
- **Contract Deploy**: `contracts/deploy_audit.js` with Hardhat
