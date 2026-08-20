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
# Edit .env: set SECRET_KEY, optionally clear DB_NAME to use SQLite

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

### Quick Start (Docker)

```bash
cp .env.example .env
docker compose up --build

# In another terminal:
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py seed_data
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

### Backend → Render / Railway

1. **Create a PostgreSQL database** on your hosting provider.
2. **Set environment variables** from `.env.example` (use production values).
3. **Build command**: `pip install -r requirements.txt && python manage.py migrate --noinput && python manage.py collectstatic --noinput`
4. **Start command**: `gunicorn trustgraph_core.wsgi:application --bind 0.0.0.0:$PORT --workers 4 --timeout 120`
5. **Root directory**: `backend/`

### Frontend → Vercel / Netlify

1. **Build command**: `npm run build`
2. **Output directory**: `dist/`
3. **Root directory**: `frontend/`
4. **Environment variable**: `VITE_API_BASE_URL=https://your-api-domain.com/api/v1`

### Post-Deployment Checklist

- [ ] Set `DEBUG=False` in production
- [ ] Set a strong `SECRET_KEY`
- [ ] Configure `ALLOWED_HOSTS` to your domain
- [ ] Set `CORS_ALLOWED_ORIGINS` to your frontend domain
- [ ] Fund the blockchain wallet with test MATIC
- [ ] Set `CONTRACT_ADDRESS` to the deployed contract
- [ ] Create a superuser on the production server
- [ ] Run `seed_data` or wait for real transaction ingestion

---

## 5. API Endpoint Reference

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
