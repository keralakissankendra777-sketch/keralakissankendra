import { NextResponse } from "next/server";
import { AuditAction } from "@/lib/types";
import { requireAdminProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cleanHttpUrl, cleanText, getClientIp, isRateLimited, isTrustedOrigin } from "@/lib/security";
import { parseProductStatus, slugify } from "@/lib/admin";
import { writeAuditLog } from "@/lib/audit";
import { normalizeCategoryLabel } from "@/lib/catalog";
import { getDerivedProductFields, parseVariationPayload } from "@/lib/variationUtils";

export async function GET(request: Request) {
  const profile = await requireAdminProfile();
  
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(`admin:products:list:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { data: products, error } = await supabase
    .from("products")
    .select(`
      *,
      category:categories (*),
      images:product_images (id, url, sort_order),
      variations:product_variations (id, label, price_inr, stock, pot_size, sort_order)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }

  return NextResponse.json({ products: products || [] });
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  const profile = await requireAdminProfile();

  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  if (isRateLimited(`admin:products:create:${ip}:${profile.id}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    imageUrls?: string[];
    variations?: unknown;
    categoryName?: string;
    status?: string;
  };

  const name = cleanText(body.name ?? "", 120);
  const rawDescription = cleanText(body.description ?? "", 600);
  const description = rawDescription || "No description provided.";
  const categoryName = cleanText(body.categoryName ?? "", 60);
  const rawImageUrls = (body.imageUrls ?? []).map((url) => url.trim()).filter(Boolean);
  const normalizedImageUrls = rawImageUrls.map((url) => cleanHttpUrl(url, 500));
  if (normalizedImageUrls.some((url) => !url)) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }
  const imageUrls = Array.from(new Set(normalizedImageUrls as string[]));
  const status = parseProductStatus(body.status);
  const categoryValue = normalizeCategoryLabel(categoryName);
  const parsedVariations = parseVariationPayload(body.variations);

  if (
    !name ||
    imageUrls.length === 0 ||
    imageUrls.length > 8 ||
    !categoryValue ||
    categoryValue.length > 60
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if ("error" in parsedVariations) {
    return NextResponse.json({ error: parsedVariations.error }, { status: 400 });
  }

  const { variations } = parsedVariations;
  const derived = getDerivedProductFields(variations);

  const categorySlug = slugify(categoryValue);
  
  // Upsert category
  const { data: existingCategory, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", categorySlug)
    .single();

  let category;
  if (existingCategory) {
    const { data: updatedCategory, error: updateError } = await supabase
      .from("categories")
      .update({ name: categoryValue, slug: categorySlug })
      .eq("slug", categorySlug)
      .select()
      .single();
    
    if (updateError) {
      console.error("Error updating category:", updateError);
      return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
    }
    category = updatedCategory;
  } else {
    const { data: newCategory, error: createError } = await supabase
      .from("categories")
      .insert({ name: categoryValue, slug: categorySlug })
      .select()
      .single();
    
    if (createError) {
      console.error("Error creating category:", createError);
      return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
    }
    category = newCategory;
  }

  // Create product
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      name,
      slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`,
      description,
      image_url: imageUrls[0],
      price_inr: derived.minPriceInr,
      stock: derived.totalStock,
      pot_size: derived.defaultPotSize,
      status,
      category_id: category.id,
    })
    .select(`
      *,
      category:categories (*),
      images:product_images (id, url, sort_order),
      variations:product_variations (id, label, price_inr, stock, pot_size, sort_order)
    `)
    .single();

  if (productError) {
    console.error("Error creating product:", productError);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }

  // Create product images
  if (imageUrls.length > 0) {
    const imageInserts = imageUrls.map((url, index) => ({
      product_id: product.id,
      url,
      sort_order: index,
    }));
    
    const { error: imageError } = await supabase
      .from("product_images")
      .insert(imageInserts);
    
    if (imageError) {
      console.error("Error creating product images:", imageError);
    }
  }

  // Create product variations
  if (variations.length > 0) {
    const variationInserts = variations.map((v, index) => ({
      product_id: product.id,
      label: v.label,
      price_inr: v.priceInr,
      stock: v.stock,
      pot_size: v.label,
      sort_order: index,
    }));
    
    const { error: variationError } = await supabase
      .from("product_variations")
      .insert(variationInserts);
    
    if (variationError) {
      console.error("Error creating product variations:", variationError);
    }
  }

  await writeAuditLog({
    action: AuditAction.ADMIN_PRODUCT_CREATE,
    actorUserId: profile.clerk_user_id,
    profileId: profile.id,
    target: product.id,
    metadata: {
      name,
      minPriceInr: derived.minPriceInr,
      totalStock: derived.totalStock,
      status,
      category: categoryValue,
      variations: variations.map((variation) => ({
        label: variation.label,
        priceInr: variation.priceInr,
        stock: variation.stock,
      })),
      imageCount: imageUrls.length,
    },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, product });
}
