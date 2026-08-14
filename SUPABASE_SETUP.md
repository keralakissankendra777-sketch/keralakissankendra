# Supabase Setup for LeafCart E-Commerce

## Environment Variables Required

Create a `.env.local` file with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Clerk Authentication (existing)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Admin Configuration
ADMIN_EMAILS=admin@example.com

# Razorpay Payment Gateway (existing)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your-secret

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

## Database Schema Setup

Run the following SQL in your Supabase SQL Editor to create the required tables:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ADMIN');
CREATE TYPE product_status AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');
CREATE TYPE pot_size_code AS ENUM ('S', 'M', 'L', 'CUSTOM');
CREATE TYPE order_status AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');
CREATE TYPE shipment_status AS ENUM ('ORDER_RECEIVED', 'ITEM_PACKED', 'ITEM_SHIPPED');
CREATE TYPE audit_action AS ENUM (
  'SIGN_IN', 'SIGN_UP', 'PRODUCT_VIEW', 'CART_ADD', 'CART_REMOVE',
  'CHECKOUT_INIT', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PROFILE_UPDATE',
  'ADMIN_PRODUCT_CREATE', 'ADMIN_PRODUCT_UPDATE', 'ADMIN_PRODUCT_DELETE',
  'ADMIN_ORDER_UPDATE'
);

-- User Profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  role user_role DEFAULT 'CUSTOMER',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_clerk_user_id ON user_profiles(clerk_user_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  price_inr INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  pot_size TEXT DEFAULT 'Medium',
  status product_status DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_pot_size ON products(pot_size);
CREATE INDEX idx_products_status ON products(status);

-- Product Images table
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);

-- Product Variations table
CREATE TABLE product_variations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  size_code pot_size_code NOT NULL,
  custom_size_label TEXT,
  label TEXT NOT NULL,
  price_inr INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_variations_product_id ON product_variations(product_id);
CREATE INDEX idx_product_variations_size_code ON product_variations(size_code);
CREATE INDEX idx_product_variations_label ON product_variations(label);

-- Cart Items table
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variation_id UUID REFERENCES product_variations(id) ON DELETE CASCADE,
  UNIQUE(profile_id, variation_id)
);

CREATE INDEX idx_cart_items_profile_id ON cart_items(profile_id);
CREATE INDEX idx_cart_items_variation_id ON cart_items(variation_id);

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  razorpay_order_id TEXT UNIQUE,
  subtotal_inr INTEGER NOT NULL,
  shipping_inr INTEGER NOT NULL,
  total_inr INTEGER NOT NULL,
  status order_status DEFAULT 'PENDING',
  recipient_name TEXT DEFAULT '',
  recipient_phone TEXT DEFAULT '',
  address_line1 TEXT DEFAULT '',
  address_line2 TEXT,
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  postal_code TEXT DEFAULT '',
  country TEXT DEFAULT 'India',
  landmark TEXT,
  delivery_notes TEXT,
  shipping_provider TEXT,
  shipping_tracking_id TEXT,
  shipment_status shipment_status DEFAULT 'ORDER_RECEIVED',
  shipping_instructions TEXT,
  shipping_url TEXT,
  shipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  profile_id UUID REFERENCES user_profiles(id) ON DELETE RESTRICT
);

CREATE INDEX idx_orders_profile_id ON orders(profile_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Order Items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quantity INTEGER NOT NULL,
  unit_price_inr INTEGER NOT NULL,
  variation_label TEXT DEFAULT '',
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_variation_id ON order_items(variation_id);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  razorpay_payment_id TEXT UNIQUE NOT NULL,
  razorpay_signature TEXT NOT NULL,
  amount_inr INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  order_id UUID UNIQUE REFERENCES orders(id) ON DELETE CASCADE
);

-- Audit Logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action audit_action NOT NULL,
  actor_user_id TEXT,
  target TEXT,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Function to upsert category
CREATE OR REPLACE FUNCTION upsert_category(p_name TEXT, p_slug TEXT)
RETURNS TABLE(id UUID, name TEXT, slug TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO categories (name, slug)
  VALUES (p_name, p_slug)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for products and categories
CREATE POLICY "Public can view active products" ON products
  FOR SELECT USING (status = 'ACTIVE');

CREATE POLICY "Public can view categories" ON categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public can view product images" ON product_images
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public can view product variations" ON product_variations
  FOR SELECT TO authenticated USING (true);

-- Users can view their own cart
CREATE POLICY "Users can view own cart" ON cart_items
  FOR SELECT USING (
    auth.uid()::text IN (
      SELECT clerk_user_id FROM user_profiles WHERE id = cart_items.profile_id
    )
  );

CREATE POLICY "Users can manage own cart" ON cart_items
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT clerk_user_id FROM user_profiles WHERE id = cart_items.profile_id
    )
  );

-- Users can view their own orders
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (
    auth.uid()::text IN (
      SELECT clerk_user_id FROM user_profiles WHERE id = orders.profile_id
    )
  );

-- Service role has full access (for server-side operations)
-- This is handled by using the service role key in server code
```

## Storage Bucket Setup

1. Go to your Supabase project dashboard
2. Navigate to Storage
3. Create a new bucket named `leafcart-media`
4. Set the bucket to **Public** (since we're serving product images publicly)
5. Configure the following policies:
   - Allow authenticated users to upload files
   - Allow public read access

## Vercel Deployment

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add all environment variables in Vercel's dashboard
4. Deploy!

## Security Considerations

1. **Never expose your SUPABASE_SERVICE_ROLE_KEY** in client-side code
2. Use Row Level Security (RLS) policies to protect data
3. The storage bucket should be public only for reading, uploads require authentication
4. All API routes verify authentication and authorization server-side
5. Rate limiting is implemented on sensitive endpoints
6. Input sanitization is performed on all user inputs
