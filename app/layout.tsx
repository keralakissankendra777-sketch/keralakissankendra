import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Header from "@/app/components/store/Header";
import "./globals.css";
import Footer from "./components/Footer";

export const metadata: Metadata = {
  title: "LeafCart",
  description: "Secure e-commerce with Clerk + Prisma + Razorpay",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider signInUrl="/login" signUpUrl="/register">
      <html lang="en">
        <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
          <Header />
          <main className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
          </main>
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
