import { NextResponse } from "next/server";
import { ProductStatus } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase";
import { cleanText, getClientIp, isRateLimited } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";
import { normalizePotSizeCode } from "@/lib/catalog";

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  
  if (isRateLimited(`products:${ip}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const query = cleanText(searchParams.get("q") ?? "", 60).toLowerCase();
  const rawCategoryParam = cleanText(searchParams.get("category") ?? "", 60);
  const categoryParam = rawCategoryParam.toLowerCase() === "all" ? "" : rawCategoryParam;
  const potSizeParam = cleanText(searchParams.get("potSize") ?? "", 40);
  const sizeCodeParam = normalizePotSizeCode(potSizeParam);

  const supabase = getSupabaseClient();

  // Build query
  let supabaseQuery = supabase
    .from('products')
    .select(`
      *,
      categories (
        id,
        name,
        slug,
        created_at,
        updated_at
      ),
      product_images (
        id,
        url,
        sort_order,
        created_at
      ),
      product_variations (
        id,
        size_code,
        custom_size_label,
        label,
        price_inr,
        stock,
        sort_order,
        created_at,
        updated_at
      )
    `)
    .eq('status', 'ACTIVE');

  // Apply category filter
  if (categoryParam) {
    supabaseQuery = supabaseQuery.eq('categories.name', categoryParam);
  }

  // Apply pot size filter
  if (sizeCodeParam) {
    supabaseQuery = supabaseQuery.contains('product_variations', [{ size_code: sizeCodeParam }]);
  }

  // Apply search query
  if (query) {
    supabaseQuery = supabaseQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
  }

  const { data: products, error } = await supabaseQuery.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }

  // Transform data to match expected format
  const normalizedProducts = products?.map((product: any) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    imageUrl: product.image_url,
    category: product.categories,
    images: product.product_images || [],
    variations: product.product_variations?.map((v: any) => ({
      id: v.id,
      productId: v.product_id,
      sizeCode: v.size_code,
      customSizeLabel: v.custom_size_label,
      label: v.label,
      priceInr: v.price_inr,
      stock: v.stock,
      sortOrder: v.sort_order,
      createdAt: v.created_at,
      updatedAt: v.updated_at
    })) || [],
    minPriceInr: Math.min(...(product.product_variations?.map((v: any) => v.price_inr) || [0])),
    totalStock: product.product_variations?.reduce((sum: number, v: any) => sum + v.stock, 0) || 0,
  }));

  await writeAuditLog({
    action: "PRODUCT_VIEW",
    metadata: { query, category: categoryParam, potSize: potSizeParam },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ products: normalizedProducts });
}
