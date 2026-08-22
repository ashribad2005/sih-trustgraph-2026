# Stage 1: Build dependencies
FROM python:3.11-slim-bookworm AS builder

WORKDIR /app

# Install system dependencies required for compiling heavy ML/Data Science C-extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install wheels
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip wheel --no-cache-dir --no-deps --wheel-dir /usr/src/app/wheels -r requirements.txt

# Stage 2: Runtime Environment
FROM python:3.11-slim-bookworm

WORKDIR /app

# Install runtime dependencies (e.g., libpq for psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy wheels from builder and install
COPY --from=builder /usr/src/app/wheels /wheels
RUN pip install --no-cache /wheels/* && rm -rf /wheels

COPY . .

# Optimize environment for ML workloads and container memory management
# MALLOC_ARENA_MAX restricts memory fragmentation often seen in ML python apps
ENV MALLOC_ARENA_MAX=2
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# Use gunicorn with slightly lower workers to avoid memory exhaustion from scikit-learn/networkx
# Adjust threads or workers based on the target instance size.
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 2 --threads 4 --timeout 120 trustgraph_core.wsgi:application"]
