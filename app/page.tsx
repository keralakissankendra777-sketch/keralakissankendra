import Link from "next/link";
import { Heart, Leaf, ShieldCheck, Truck } from "lucide-react";
import Button from "@/app/components/ui/Button";
import ProductCard from "@/app/components/store/ProductCard";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: featuredRows } = await supabaseAdmin
    .from("products")
    .select(`
      *,
      category:categories(id, name),
      images:product_images(url, sort_order),
      variations:product_variations(price_inr, stock, sort_order)
    `)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(8);

  const featuredProducts = (featuredRows ?? []).map((product: any) => {
    const variations = product.variations ?? [];
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      imageUrl: product.image_url,
      category: product.category,
      images: product.images ?? [],
      minPriceInr: variations.length > 0 ? Math.min(...variations.map((variation: any) => variation.price_inr)) : 0,
      totalStock: variations.reduce((sum: number, variation: any) => sum + variation.stock, 0),
    };
  });

  return (
    <div className="min-h-screen">
      <section className="relative flex min-h-[90vh] items-center overflow-hidden bg-zinc-50 pt-20">
        <div className="absolute right-0 top-0 z-0 h-full w-1/2 rounded-bl-[100px] bg-emerald-100/50" />
        <div className="absolute left-10 top-20 h-20 w-20 rounded-full bg-emerald-200/40 blur-2xl" />

        <div className="container relative z-10 mx-auto grid grid-cols-1 items-center gap-12 px-6 md:grid-cols-2">
          <div>
            <h1 className="mb-6 text-5xl font-bold leading-tight text-zinc-900 md:text-7xl">
              Nurturing <br />
              <span className="text-emerald-600">green</span> dreams
            </h1>
            <p className="mb-8 max-w-lg text-xl leading-relaxed text-zinc-600">
              Discover our curated collection of indoor and outdoor plants that purify the air and uplift your mood.
            </p>
            <div className="flex gap-4">
              <Button href="/shop" variant="primary">
                Shop Now
              </Button>
              <Button href="#footer" variant="outline">
                Learn More
              </Button>
            </div>
          </div>

          <div className="relative hidden md:block">
            <div className="relative z-10 rounded-full border border-white/50 bg-white/30 p-8 shadow-xl backdrop-blur-sm">
              <img
                src="https://images.pexels.com/photos/15176013/pexels-photo-15176013.jpeg"
                alt="Beautiful Plant"
                className="h-auto w-full rounded-full shadow-2xl transition-transform duration-700 hover:scale-105"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Truck size={32} className="text-emerald-600" />,
                title: "Fast Delivery",
                desc: "Get your plants delivered to your doorstep.",
              },
              {
                icon: <ShieldCheck size={32} className="text-emerald-600" />,
                title: "Quality Guarantee",
                desc: "We ensure all plants are healthy and fresh upon arrival.",
              },
              {
                icon: <Leaf size={32} className="text-emerald-600" />,
                title: "Eco-Friendly",
                desc: "Our packaging is 100% biodegradable and earth-friendly.",
              },
              {
                icon: <Heart size={32} className="text-emerald-600" />,
                title: "Plant Care Support",
                desc: "Lifetime support for all your plant parenting queries.",
              },
            ].map((feature) => (
              <article
                key={feature.title}
                className="group rounded-3xl border border-zinc-100 bg-zinc-50 p-8 transition-all duration-300 hover:shadow-lg"
              >
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white p-4 shadow-sm transition-transform group-hover:scale-110">
                  {feature.icon}
                </div>
                <h3 className="mb-3 text-xl font-bold text-zinc-800">{feature.title}</h3>
                <p className="leading-relaxed text-zinc-500">{feature.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-zinc-50 py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="mb-4 text-4xl font-bold">Shop by Category</h2>
          <p className="mb-12 text-zinc-600">Find the perfect plant for your space.</p>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                name: "Indoor",
                displayName: "Indoor Plants",
                img: "https://images.unsplash.com/photo-1545241047-6083a3684587?q=80&w=1000&auto=format&fit=crop",
              },
              {
                name: "Outdoor",
                displayName: "Outdoor Plants",
                img: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?q=80&w=1000&auto=format&fit=crop",
              },
              {
                name: "All",
                displayName: "All Plants",
                img: "https://images.pexels.com/photos/4505162/pexels-photo-4505162.jpeg",
              },
            ].map((category) => (
              <Link
                key={category.name}
                href={category.name === "All" ? "/shop" : `/shop?category=${category.name}`}
                className="group relative h-80 cursor-pointer overflow-hidden rounded-3xl shadow-md"
              >
                <img
                  src={category.img}
                  alt={category.displayName}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-colors group-hover:bg-black/50">
                  <h3 className="text-3xl font-bold text-white">{category.displayName}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="container mx-auto px-6">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-4xl font-bold text-zinc-900">Featured Collection</h2>
            <Link href="/shop" className="text-sm font-bold text-emerald-700 hover:underline">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredProducts.map((product) => (
              <div key={product.id}>
                <ProductCard
                  product={{
                    id: product.id,
                    slug: product.slug,
                    name: product.name,
                    description: product.description,
                    imageUrl: product.imageUrl,
                    category: product.category,
                    images: product.images,
                    minPriceInr: product.minPriceInr,
                    totalStock: product.totalStock,
                  }}
                />
              </div>
            ))}
          </div>
          {featuredProducts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-600">
              Products will appear here once they are added from Admin.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
