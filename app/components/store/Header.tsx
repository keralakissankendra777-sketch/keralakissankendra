"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Image from "next/image";

export default function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
            {/* Wrapper div defines the visual size of the logo */}
            <div className="relative h-10 w-10"> 
              <Image 
                src="/logo.jpeg" 
                alt="LeafCart Logo" 
                fill
                className="object-contain" // Keeps the aspect ratio without stretching
                priority
              />
            </div>
            <span className="text-2xl font-black tracking-tight text-emerald-700">
              LeafCart
            </span>
          </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-zinc-700">
          <Link href="/">Shop</Link>
          <Link href="/cart">Cart</Link>
          <SignedIn>
            <Link href="/orders">Orders</Link>
            <Link href="/admin">Admin</Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Link href="/login">Login</Link>
            <Link href="/register" className="rounded-full bg-emerald-700 px-4 py-2 text-white">
              Sign up
            </Link>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
}
