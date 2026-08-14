# LeafCart - E-Commerce Platform (Clerk + Supabase + Vercel + Razorpay)

LeafCart is a full-stack e-commerce app with:
- Custom Clerk auth UI (`/login`, `/register`)
- Supabase PostgreSQL database with Row Level Security (RLS)
- Supabase Storage CDN for product images
- Razorpay checkout with server-side verification
- Role-based admin dashboard (`/admin`)
- Comprehensive audit logging
- Deployed on Vercel with edge-optimized API routes

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
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGc... (keep secret, never expose to client)"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Razorpay Payment Gateway
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."

# Admin Configuration
ADMIN_EMAILS="admin@example.com,owner@example.com"

# Application URLs
APP_URL="https://your-app.vercel.app"
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
```

**Security Note:** The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and should only be used server-side. Never expose it in client-side code or browser.

## Architecture Overview

### Database Layer (Supabase PostgreSQL)
- All tables have Row Level Security (RLS) policies enabled
- Service role key used only in API routes for server-side operations
- Client-side queries use anon key with strict RLS policies
- Automatic connection pooling via Supabase

### Storage Layer (Supabase Storage CDN)
- Product images stored in `leafcart-media` bucket
- Public bucket with CDN delivery for fast global access
- MIME type validation and file size limits (5MB max)
- Automatic image optimization via Supabase transformations

### Hosting (Vercel)
- Serverless functions for API routes
- Edge caching for static assets
- Automatic HTTPS and global CDN
- Zero-config deployments from Git

## Setup (Local Development)

1. Install dependencies:
```bash
npm install
```

2. Create env file:
```bash
cp .env.example .env
```

3. Configure your Supabase project:
   - Create a new project at https://supabase.com
   - Run the SQL migration scripts in `supabase/migrations/`
   - Create a storage bucket named `leafcart-media` (public)
   - Copy your project URL and service role key to `.env`

4. Start app:
```bash
npm run dev
```

5. Optional seed sample products (admin only):
```bash
curl -X POST http://localhost:3000/api/seed
```

## Supabase Database Setup

### Option 1: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/*.sql` files
4. Execute the SQL to create all tables, indexes, and RLS policies

### Option 2: Using Supabase CLI
```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

### Storage Bucket Setup
1. In Supabase Dashboard, go to Storage
2. Create a new bucket: `leafcart-media`
3. Set bucket to **Public**
4. Add RLS policies:
   - Allow authenticated users to INSERT
   - Allow public to SELECT
   - Allow bucket owners to UPDATE/DELETE

Example RLS policy for storage:
```sql
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'leafcart-media');

CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'leafcart-media');
```

## Deployment on Vercel (Recommended)

### 1. Prepare Your Repository
Ensure your code is pushed to GitHub/GitLab/Bitbucket.

### 2. Connect to Vercel
```bash
npm install -g vercel
vercel login
vercel link
```

Or use the Vercel dashboard:
1. Go to https://vercel.com/new
2. Import your Git repository
3. Configure project settings

### 3. Set Environment Variables in Vercel
In Vercel Dashboard → Project Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (production key)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
ADMIN_EMAILS=admin@example.com
APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Important:** Mark `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, and `RAZORPAY_KEY_SECRET` as **Sensitive** (not exposed to browser).

### 4. Deploy
```bash
vercel --prod
```

Or push to your main branch for automatic deployment.

### 5. Configure Custom Domain (Optional)
In Vercel Dashboard → Project Settings → Domains:
1. Add your custom domain
2. Update DNS records as instructed
3. Vercel automatically provisions SSL certificate

### 6. Update Supabase CORS Settings
In Supabase Dashboard → API Settings:
1. Add your Vercel domain to allowed origins:
   ```
   https://your-app.vercel.app
   https://your-custom-domain.com
   ```

## Manual Deployment (Alternative)

If not using Vercel's Git integration:

### 1. Build the application
```bash
npm run build
```

### 2. Start production server
```bash
npm start
```

### 3. Use a process manager (PM2)
```bash
npm install -g pm2
pm2 start npm --name "leafcart" -- start
pm2 save
pm2 startup
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
curl -X POST https://your-app.vercel.app/api/admin/bootstrap
```

4. Open `/admin`.

### Admin operations

- Add/Edit/Delete products
- Upload multiple product images (stored in Supabase Storage CDN)
- Manage order status
- Add postal tracking details:
  - provider
  - tracking id
  - tracking URL
  - tracking instructions
- Paginate through orders

## User Flow

1. Register/login via Clerk
2. Browse products (images served via Supabase CDN)
3. Add to cart
4. Checkout with shipping details
5. Pay with Razorpay
6. Verify payment server-side
7. View order and tracking info in `/orders`

## Security Features

### Database Security
- **Row Level Security (RLS)**: All tables enforce access policies
- **Service Role Key**: Used only server-side, never exposed to client
- **Parameterized Queries**: Prevents SQL injection attacks
- **Input Sanitization**: All user inputs cleaned via `cleanText()` and `cleanHttpUrl()`

### API Security
- **Authentication Enforcement**: All mutating endpoints require valid Clerk session
- **Role-Based Access Control**: Admin endpoints verify admin status
- **Origin Validation**: CSRF protection via origin header checks
- **Rate Limiting**: Sensitive endpoints protected against abuse
- **Signature Verification**: Razorpay webhooks verified with HMAC

### Storage Security
- **MIME Type Validation**: Only images allowed in media bucket
- **File Size Limits**: Maximum 5MB per file
- **Bucket Policies**: RLS on storage objects
- **CDN Delivery**: Secure, cached delivery via Supabase CDN

### General Security
- **Environment Variables**: Secrets never committed to Git
- **HTTPS Only**: All production traffic encrypted
- **Audit Logging**: All critical actions logged for compliance
- **Stock Validation**: Prevents overselling during checkout

## Operational Notes

- All API routes are optimized for Vercel serverless functions
- Database connections are properly managed to prevent exhaustion
- Images are uploaded directly to Supabase Storage with CDN delivery
- Audit logs capture sign-in/sign-up, cart actions, checkout, payment outcomes, and admin actions
- Keep secrets out of git; rotate keys if exposed
- Regular backups enabled via Supabase dashboard

## Troubleshooting

### 1. Database connection errors
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Check Supabase project status at https://status.supabase.com
- Ensure service role key is valid and has not expired

### 2. Images not loading
- Confirm `leafcart-media` bucket exists and is public
- Check RLS policies on storage.objects table
- Verify image URLs in database match Supabase storage paths
- Clear browser cache and Vercel deployment cache

### 3. Clerk authentication issues
- Complete email verification flow in `/register`
- Check Clerk dashboard for any account restrictions
- Verify publishable and secret keys match environment

### 4. Razorpay payment failures
- Confirm `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are correct
- Check Razorpay dashboard for payment logs
- Verify webhook signature validation in logs
- Test mode vs live mode key mismatch

### 5. RLS policy violations
- Review RLS policies in Supabase SQL Editor
- Ensure service role key is used for server-side operations
- Check that authenticated user IDs match expected formats

### 6. Vercel deployment failures
- Check Vercel function logs in dashboard
- Verify all environment variables are set correctly
- Ensure build completes successfully: `vercel build`
- Check for Node.js version compatibility in `package.json`

## Backup and Recovery

### Database Backups
Supabase provides automatic daily backups. To restore:
1. Go to Supabase Dashboard → Database → Backups
2. Select a backup point
3. Click "Restore"

### Manual Backup
```bash
# Export database schema and data
pg_dump "postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres" > backup.sql
```

### Storage Backup
Download files from Supabase Storage dashboard or use Supabase CLI:
```bash
supabase storage download leafcart-media ./backup-files
```

## Migration from Prisma/MinIO

If migrating from the previous Prisma + MinIO setup:

1. **Database Migration**
   - Export data from PostgreSQL
   - Run Supabase migration scripts
   - Import data into Supabase tables

2. **Storage Migration**
   - Download all files from MinIO bucket
   - Upload to Supabase Storage `leafcart-media` bucket
   - Update image URLs in database

3. **Update Environment Variables**
   - Remove MinIO-related variables
   - Add Supabase configuration
   - Update deployment target to Vercel

4. **Test Thoroughly**
   - Verify all CRUD operations
   - Test image uploads and CDN delivery
   - Validate payment flow end-to-end
   - Check admin dashboard functionality

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@leafcart.com or open an issue in the repository.

## Acknowledgments

- [Clerk](https://clerk.com) for authentication
- [Supabase](https://supabase.com) for database and storage
- [Vercel](https://vercel.com) for hosting
- [Razorpay](https://razorpay.com) for payment processing
