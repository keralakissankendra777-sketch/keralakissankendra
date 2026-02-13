"use client";

import Link from "next/link";
import { SignedIn, SignedOut, useClerk, useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Leaf, LogOut, Menu, ShoppingCart, User, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function Header() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const adminEmails = useMemo(
    () =>
      (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
        .split(",")
        .map((row) => row.trim().toLowerCase())
        .filter(Boolean),
    [],
  );

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const isAdmin = !!userEmail && adminEmails.includes(userEmail.toLowerCase());
  const userDisplayName = (user?.fullName ?? userEmail.split("@")[0] ?? "User").trim();
  const cartTooltip = cartCount === 0 ? "Cart is empty" : `${cartCount} item${cartCount > 1 ? "s" : ""} in cart`;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const closeOnRouteChange = () => setIsMenuOpen(false);
    window.addEventListener("popstate", closeOnRouteChange);
    return () => window.removeEventListener("popstate", closeOnRouteChange);
  }, [isMenuOpen]);

  useEffect(() => {
    let cancelled = false;

    async function fetchCartCount() {
      if (!user) {
        setCartCount(0);
        return;
      }

      try {
        const res = await fetch("/api/cart", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setCartCount(0);
          }
          return;
        }

        const data = (await res.json()) as { items?: Array<{ quantity: number }> };
        const nextCount = (data.items ?? []).reduce((sum, row) => sum + row.quantity, 0);
        if (!cancelled) {
          setCartCount(nextCount);
        }
      } catch {
        if (!cancelled) {
          setCartCount(0);
        }
      }
    }

    void fetchCartCount();

    return () => {
      cancelled = true;
    };
  }, [user?.id, pathname]);

  const handleLogout = async () => {
    await signOut({ redirectUrl: "/login" });
    setIsMenuOpen(false);
  };

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
  ];

  return (
    <header
      className={`fixed z-50 w-full border-b border-zinc-100 bg-white/95 backdrop-blur-md shadow-sm transition-all duration-300 ${
        scrolled ? "py-3" : "py-4"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-emerald-800">
          <div className="relative h-8 w-8">
            <Image
              src="/logo.jpeg"
              alt="Kerala Kissan Kendra"
              fill
              className="rounded-full object-cover"
              priority
            />
          </div>
          <span className="hidden sm:inline">Kerala Kissan Kendra</span>
          <span className="sm:hidden">
            <Leaf className="text-emerald-600" />
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.path}
              className="text-sm font-bold tracking-wide text-zinc-700 transition-colors duration-300 hover:text-emerald-700"
            >
              {link.name}
            </Link>
          ))}

          <SignedIn>
            <Link
              href="/orders"
              className="text-sm font-bold tracking-wide text-zinc-700 transition-colors duration-300 hover:text-emerald-700"
            >
              Track Order
            </Link>
          </SignedIn>

          <SignedIn>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800"
                >
                  Admin
                </Link>
              )}

              <div className="flex items-center gap-2 rounded-full border border-zinc-200/50 bg-white/80 px-4 py-1.5 text-emerald-900 shadow-sm backdrop-blur-md">
                <User size={16} className="text-emerald-600" />
                <span className="text-sm font-bold">
                  {userDisplayName}
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="text-zinc-500 transition hover:text-red-500"
                aria-label="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </SignedIn>

          <SignedOut>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-bold text-zinc-700 transition-colors hover:text-emerald-700"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-green-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-green-600/30 transition hover:bg-green-700"
              >
                Sign Up
              </Link>
            </div>
          </SignedOut>

          <Link
            href="/cart"
            className="group relative text-zinc-700 transition hover:text-emerald-700"
            title={cartTooltip}
            aria-label={cartTooltip}
          >
            <div className="rounded-full bg-zinc-100 p-2 transition-colors group-hover:bg-emerald-50">
              <ShoppingCart size={20} />
            </div>
            <span className="pointer-events-none absolute -top-10 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow transition-opacity group-hover:opacity-100 lg:block">
              {cartTooltip}
            </span>
            {cartCount > 0 ? (
              <span className="absolute -right-1 -top-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {cartCount}
              </span>
            ) : null}
          </Link>
        </nav>

        <button
          type="button"
          className="text-emerald-800 md:hidden"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="absolute left-0 top-full flex w-full animate-slide-up flex-col gap-4 border-t border-emerald-100 bg-white/95 p-6 shadow-lg backdrop-blur-md md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.path}
              className="border-b border-zinc-100 py-2 text-lg font-medium text-emerald-800"
              onClick={() => setIsMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}

          <SignedIn>
            <Link
              href="/orders"
              className="border-b border-zinc-100 py-2 text-lg font-medium text-emerald-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Track Order
            </Link>
          </SignedIn>

          <div className="mt-4 flex flex-col gap-3">
            <SignedIn>
              <div className="mb-2 flex items-center gap-2 text-emerald-800">
                <User size={18} />
                <span className="text-sm font-medium">{userEmail || "Logged in user"}</span>
              </div>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-center font-semibold text-emerald-800"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-center font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Logout
              </button>
            </SignedIn>

            <SignedOut>
              <Link
                href="/login"
                className="py-2 text-center font-bold text-emerald-800"
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/register"
                className="w-full rounded-lg bg-green-600 px-4 py-2 text-center font-semibold text-white hover:bg-green-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Register
              </Link>
            </SignedOut>

            <Link
              href="/cart"
              className="flex items-center gap-2 py-2 font-medium text-emerald-800"
              onClick={() => setIsMenuOpen(false)}
            >
              <ShoppingCart size={20} /> Cart {cartCount > 0 ? `(${cartCount})` : ""}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
