# LeafCart - E-Commerce Platform (Clerk + Prisma + PostgreSQL + Razorpay)

LeafCart is a full-stack e-commerce app with:
- Custom Clerk auth UI (`/login`, `/register`)
- Prisma ORM on PostgreSQL
- Razorpay checkout with server-side verification
- Role-based admin dashboard (`/admin`)
- Audit logging
- MinIO object storage for product images

## URL Map

- Storefront: `/`
- Login: `/login`
- Register: `/register`
- Cart: `/cart`
- Checkout: `/checkout`
- Orders: `/orders`
- Admin dashboard: `/admin`

## Environment Variables

Create `.env` in project root (recommended from template):

```bash
cp .env.example .env
```

Then edit `.env` values:

```bash
DATABASE_URL="postgresql://leafcart:leafcart@localhost:5432/leafcart?schema=public"

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."

ADMIN_EMAILS="admin@example.com,owner@example.com"

MINIO_ENDPOINT="http://127.0.0.1:9000"
MINIO_REGION="us-east-1"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET="leafcart-media"
MINIO_PUBLIC_URL="http://127.0.0.1:9000/leafcart-media"

APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Setup (Local Development)

1. Install dependencies:
```bash
npm install
```

2. Create env file:
```bash
cp .env.example .env
```

3. Start infra (Postgres + MinIO):
```bash
docker compose up -d
```

4. Run Prisma migrations and generate client:
```bash
npx prisma migrate deploy
npx prisma generate
```

5. Start app:
```bash
npm run dev
```

6. Optional seed sample products (admin only):
```bash
curl -X POST http://localhost:3000/api/seed
```

## Setup (Production with Docker Compose)

Use the production stack in `docker-compose.prod.yml` (app + postgres + minio + minio-init).

1. Keep `.env` in root and update production values:
- create from template first:
```bash
cp .env.example .env
```
- real Clerk live keys
- real Razorpay live keys
- production `APP_URL` / `NEXT_PUBLIC_APP_URL`
- production `MINIO_PUBLIC_URL` (public domain URL, not `127.0.0.1`)
- secure DB and MinIO credentials

2. Build and start:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

3. Check status:
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
```

4. Stop:
```bash
docker compose -f docker-compose.prod.yml down
```

Notes:
- App container runs `npx prisma migrate deploy` automatically before `next start`.
- Image uploads are saved to MinIO bucket (`leafcart-media` by default).

## Deployment on Linux Production (VPS/Dedicated Server)

This is the recommended server flow for Ubuntu 22.04/24.04 (similar for Debian).

### 1. Install Docker and Compose plugin

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out/in once so `docker` works without `sudo`.

### 2. Copy project and prepare env

```bash
mkdir -p ~/apps/leafcart
cd ~/apps/leafcart
```

Copy your project files here, then create `.env` with production values:
- live Clerk keys
- live Razorpay keys
- secure Postgres/MinIO creds
- `APP_URL` and `NEXT_PUBLIC_APP_URL` as your HTTPS domain
- `MINIO_PUBLIC_URL` as your public object URL/domain

### 3. Build and run stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Open required firewall ports

If using UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

For security, do not expose `5432` publicly unless absolutely needed.

### 5. Reverse proxy + TLS (Nginx + Let's Encrypt)

Install:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Minimal Nginx site (`/etc/nginx/sites-available/leafcart`):

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/leafcart /etc/nginx/sites-enabled/leafcart
sudo nginx -t
sudo systemctl reload nginx
```

Issue HTTPS cert:

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 6. Update app URLs after TLS

In `.env` set:

```bash
APP_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
MINIO_PUBLIC_URL=https://assets.your-domain.com/leafcart-media
```

Then restart:

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 7. Ongoing operations

Deploy update:

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

View logs:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

Backups (example Postgres dump):

```bash
docker exec -t leafcart-postgres pg_dump -U leafcart -d leafcart > leafcart-$(date +%F).sql
```

## Admin Setup and Flow

### First-time admin bootstrap

1. Put admin emails in `.env`:
```bash
ADMIN_EMAILS=admin@example.com,owner@example.com
```
2. Register/login with one of those emails via Clerk.
3. Call bootstrap once while logged in:
```bash
curl -X POST http://localhost:3000/api/admin/bootstrap
```
4. Open `/admin`.

### Admin operations

- Add/Edit/Delete products
- Upload multiple product images
- Manage order status
- Add postal tracking details:
  - provider
  - tracking id
  - tracking URL
  - tracking instructions
- Paginate through orders

## User Flow

1. Register/login
2. Browse products
3. Add to cart
4. Checkout with shipping details
5. Pay with Razorpay
6. Verify payment server-side
7. View order and tracking info in `/orders`

## Operational and Security Notes

- Mutating APIs enforce auth, role checks (admin endpoints), origin checks, and rate limits.
- Checkout and verify enforce stock validation.
- Payment verify checks Razorpay signature and payment/order/amount details.
- Audit logs capture sign-in/sign-up, cart actions, checkout, payment outcomes, and admin actions.
- Keep secrets out of git; rotate keys if exposed.

## Troubleshooting

1. `Can't reach database server at localhost:5432`
- Ensure Postgres is running:
```bash
docker compose ps
```

2. Images not loading on storefront
- Set correct `MINIO_PUBLIC_URL` and add image domain in `next.config.ts`.

3. Clerk signup says `missing_requirements`
- Complete verification flow in `/register` (email code step).

4. Razorpay payment not finalizing
- Check `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and app logs:
```bash
docker compose -f docker-compose.prod.yml logs -f app
```
