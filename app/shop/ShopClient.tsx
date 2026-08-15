"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/app/components/store/ProductCard";
import { DEFAULT_CATEGORY_VALUES, normalizeCategoryLabel } from "@/lib/catalog";

type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  minPriceInr: number;
  totalStock: number;
  images: Array<{ url: string }>;
  category: {
    name: string;
  };
};

type CategoryFilter = "All" | string;

export default function ShopClient() {
  const searchParams = useSearchParams();
  const initialCategory = normalizeCategoryLabel(searchParams.get("category")) || "All";
  const initialSearch = searchParams.get("search") ?? "";

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CategoryFilter>("All");
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [categories, setCategories] = useState<string[]>(["All", ...DEFAULT_CATEGORY_VALUES]);

  useEffect(() => {
    setFilter(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    let cancelled = false;

    async function fetchProducts() {
      setLoading(true);
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        const data = (await res.json()) as { products?: ShopProduct[] };

        if (!cancelled && res.ok) {
          const rows = data.products ?? [];
          setProducts(rows);
          const customCategories = Array.from(new Set(rows.map((product) => normalizeCategoryLabel(product.category.name)).filter(Boolean)));
          const merged = ["All", ...new Set([...DEFAULT_CATEGORY_VALUES, ...customCategories])];
          setCategories(merged);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const categoryName = normalizeCategoryLabel(product.category.name);
      const matchesCategory = filter === "All" || categoryName === filter;
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, filter, searchQuery]);

  return (
    <div className="min-h-screen bg-zinc-50 pb-20 pt-28">
      <div className="container mx-auto px-6">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-emerald-900 md:text-5xl">Explore Our Collection</h1>
          <p className="mx-auto max-w-xl text-zinc-500">
            Find the perfect green companion for your space from our wide range of plants and accessories.
          </p>
        </div>

        <div className="mx-auto mb-10 flex max-w-5xl flex-col items-center justify-between gap-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:flex-row">
          <div className="flex w-full gap-3 overflow-x-auto py-2 md:w-auto">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setFilter(category)}
                className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-bold transition-all duration-300 ${
                  filter === category
                    ? "border-green-600 bg-green-600 text-white shadow-md"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="Search plants..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-full border border-transparent bg-zinc-50 py-2 pl-10 pr-4 text-sm transition-all placeholder:text-zinc-400 focus:border-green-300 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-emerald-600" />
          </div>
        ) : null}

        {!loading ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <div key={product.id}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && filteredProducts.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mb-4 inline-block rounded-full bg-zinc-100 p-6">
              <Search size={48} className="text-zinc-300" />
            </div>
            <h3 className="text-xl font-bold text-zinc-800">No products found</h3>
            <p className="mt-2 text-zinc-500">Try adjusting your filters.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
