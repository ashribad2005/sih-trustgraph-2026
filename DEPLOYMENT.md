# TrustGraph 2026 — Deployment Guide

> Deployment playbook for the AI-Driven Financial Fraud Network Intelligence  
> & Tamper-Evident Audit Platform (SOAIDEATHON-S40)

---

## 1. Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL 16+ (optional — SQLite fallback available)

### Quick Start (No Docker)

```bash
# 1. Clone & configure
cp .env.example .env
# Edit .env: set SECRET_KEY; leave DATABASE_URL empty to use local SQLite

# 2. Backend setup
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

python manage.py migrate
python manage.py createsuperuser   # Create admin user for JWT auth
python manage.py seed_data         # Load test transactions
python manage.py runserver

# 3. Frontend setup (new terminal)
cd frontend
npm install
npm run dev
# → Open http://localhost:5173
```

### Quick Start (Docker - Development)

```bash
cp .env.example .env
docker compose up --build

# In another terminal:
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py seed_data
```

### Quick Start (Docker - Production)

```bash
# 1. Create production env file
cp .env.prod.example .env.prod
# Edit .env.prod with ALL production secrets

# 2. Deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d

# 3. Schema migration runs automatically during container start; create an operator account
# Migrations run automatically during container start; this is an optional idempotent check.
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_data --process
```

---

## 2. Testing the Pipeline

### Get a JWT Token

```bash
curl -X POST http://localhost:8000/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}'
```

### Ingest a Test Transaction

```bash
curl -X POST http://localhost:8000/api/v1/transactions/ingest/ \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
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
```

Expected result: `risk_score >= 75` → case created, blockchain anchored.

### Verify Integrity

```bash
curl http://localhost:8000/api/v1/cases/TG-2026-00001/verify-integrity/ \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## 3. Smart Contract Deployment (Polygon Amoy)

### Prerequisites
- Node.js 20+
- MATIC test tokens from the [Polygon Faucet](https://faucet.polygon.technology/)

### Deploy

```bash
# Install Hardhat deps (project root)
npm install

# Compile the contract
npx hardhat compile

# Deploy to Polygon Amoy testnet
npx hardhat run contracts/deploy_audit.js --network polygonAmoy

# Copy the deployed contract address → .env → CONTRACT_ADDRESS
```

### Verify on PolygonScan (Optional)

```bash
npx hardhat verify --network polygonAmoy <CONTRACT_ADDRESS>
```

---

## 4. Production Deployment

### Option A: Render (Recommended - Full Stack)

#### Backend → Render Web Service + PostgreSQL

1. **Push to GitHub/GitLab** (required for Render Blueprint)
2. **Use the Render Blueprint** (render.yaml in repo root):
   - In Render Dashboard: New → Blueprint → Connect repo
   - Render auto-creates PostgreSQL + Web Service
3. **Set Environment Variables in Render Dashboard** (Environment):
   - `SECRET_KEY` — Render can generate this through the Blueprint
   - `DATABASE_URL` — Use the PostgreSQL connection string from the Render database
   - `DEBUG=False`
   - `ALLOWED_HOSTS=trustgraph-api.onrender.com`
   - `CORS_ALLOWED_ORIGINS=https://<your-vercel-domain>`
   - `AI_ENGINE_ENABLED=True`
   - `RISK_THRESHOLD=75`
   - `WEB3_RPC_URL`, `CONTRACT_ADDRESS`, and `WALLET_PRIVATE_KEY` — optional for live Polygon anchoring; without them the app reports transparent deterministic MOCK anchoring
4. **Deploy** — Render builds from `backend/Dockerfile`. Container startup runs migrations, processes `backend/data/transactions_seed.demo.json` through rules + ML + graph + evidence hashing + blockchain mode, and then starts Gunicorn.
5. **Create an operator account** in the Render Shell after the first successful deploy:
   ```bash
   python manage.py createsuperuser
   ```

#### Frontend → Render Static Site

1. **Create new Static Site** in Render Dashboard
2. **Connect same repo**, set:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
3. **Environment Variable**: `VITE_API_BASE_URL=https://trustgraph-api.onrender.com/api/v1`
4. **Set the Render backend variable** `CORS_ALLOWED_ORIGINS` to the exact Vercel origin, without a trailing slash.
5. **Add Rewrite Rule** (Settings → Redirects/Rewrites):
   - Source: `/*` → Destination: `/index.html` (Type: Rewrite)

### Option B: Railway / Fly.io / DigitalOcean App Platform

#### Backend
1. **Create PostgreSQL** on your hosting provider
2. **Set Environment Variables** from `.env.prod.example` (use production values)
3. **Build Command**: `pip install -r requirements.txt && python manage.py migrate --noinput && python manage.py collectstatic --noinput`
4. **Start Command**: `gunicorn trustgraph_core.wsgi:application --bind 0.0.0.0:$PORT --workers 4 --timeout 120`
5. **Root Directory**: `backend/`

#### Frontend
1. **Build Command**: `npm run build`
2. **Output Directory**: `dist/`
3. **Root Directory**: `frontend/`
4. **Environment Variable**: `VITE_API_BASE_URL=https://your-api-domain.com/api/v1`

### Option C: Docker (Self-Hosted / VPS / Kubernetes)

```bash
# 1. Prepare production environment
cp .env.prod.example .env.prod
# Edit .env.prod with all production values

# 2. Deploy with production compose
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d

# 3. Run migrations
# Migrations run automatically during container start; this is an optional idempotent check.
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_data --process

# 4. Configure reverse proxy (nginx/Traefik/Caddy) with SSL
#    Point your domain to the frontend container (port 80)
#    Point api.yourdomain.com to the backend container (port 8000)
```

---

## 5. Post-Deployment Checklist

- [ ] Set `DEBUG=False` in production
- [ ] Set a strong `SECRET_KEY` (auto-generated on Render)
- [ ] Confirm the deployment has applied all migrations; container startup runs `migrate --noinput`
- [ ] Configure `ALLOWED_HOSTS` to your domain(s)
- [ ] Set `CORS_ALLOWED_ORIGINS` to your frontend domain
- [ ] Fund the blockchain wallet with test MATIC (or real MATIC for mainnet)
- [ ] Set `CONTRACT_ADDRESS` to the deployed contract
- [ ] Create a superuser on the production server
- [ ] Confirm automatic `seed_data --process` created demo cases, evidence hashes, and blockchain-mode records
- [ ] Configure SSL/TLS (automatic on Render/Vercel/Netlify)
- [ ] Set up monitoring (Render metrics, Datadog, etc.)
- [ ] Configure backup strategy for PostgreSQL

---

## 6. API Endpoint Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/token/` | No | JWT login |
| POST | `/api/v1/auth/token/refresh/` | No | JWT refresh |
| POST | `/api/v1/transactions/ingest/` | Yes | Ingest transaction(s) |
| GET | `/api/v1/cases/` | Yes | List fraud cases |
| GET | `/api/v1/cases/{id}/` | Yes | Case detail + graph |
| POST | `/api/v1/cases/{id}/action/` | Yes | Investigator action |
| GET | `/api/v1/cases/{id}/verify-integrity/` | Yes | Blockchain verification |
| GET | `/api/v1/cases/{id}/graph/` | Yes | Case graph data |
| GET | `/api/v1/dashboard/metrics/` | Yes | Dashboard KPIs |

---

## 7. Environment Variable Reference

### Backend (Required)
| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key (50+ chars) | generated by the platform |
| `DEBUG` | Debug mode | `False` |
| `ALLOWED_HOSTS` | Comma-separated allowed hosts | `api.example.com` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `CORS_ALLOWED_ORIGINS` | Frontend origin(s) | `https://app.example.com` |
| `WEB3_RPC_URL` | Polygon RPC endpoint | `https://polygon-amoy.g.alchemy.com/v2/...` |
| `CHAIN_ID` | Network chain ID | `80002` |
| `WALLET_PRIVATE_KEY` | Service wallet private key | `0x...` (SECRET!) |
| `CONTRACT_ADDRESS` | Deployed audit contract | `0x...` |

### Backend (Optional)
| Variable | Description | Default |
|----------|-------------|---------|
| `AI_ENGINE_ENABLED` | Enable real ML engine | `True` |
| `RISK_THRESHOLD` | Fraud case threshold | `75` |
| `JWT_ACCESS_LIFETIME_MINUTES` | Access token TTL | `30` |
| `JWT_REFRESH_LIFETIME_DAYS` | Refresh token TTL | `1` |
| `GEMINI_API_KEY` | Google Gemini API key | — |
| `POLYGONSCAN_API_KEY` | PolygonScan API key | — |

### Frontend (Build-time)
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `https://api.example.com/api/v1` |

---

## 8. Troubleshooting

### Backend won't start
- Check `docker logs trustgraph-backend` or Render logs
- Verify `DATABASE_URL` is correct and database is accessible
- Ensure `SECRET_KEY` is set

### Frontend shows blank page
- Check browser console for errors
- Verify `VITE_API_BASE_URL` is correct in build
- Check nginx config for SPA routing (rewrite to index.html)

### Blockchain anchoring fails
- Verify `WALLET_PRIVATE_KEY` has MATIC balance
- Check `CONTRACT_ADDRESS` is correct and deployed on right network
- Verify `WEB3_RPC_URL` is accessible and correct chain ID

### ML Engine memory issues
- Increase instance memory (minimum 2GB, recommended 4GB+)
- Reduce Gunicorn workers: `--workers 1 --threads 2`
- Set `MALLOC_ARENA_MAX=2` (already in Dockerfile)
