"use client";

import Link from "next/link";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Toast from "@/app/components/ui/Toast";

type ToastItem = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "errors" in error) {
    const maybeErrors = (error as { errors?: Array<{ message?: string }> }).errors;
    const first = maybeErrors?.[0]?.message;
    if (first) {
      return first;
    }
  }
  return fallback;
}

export default function LoginPage() {
  const { signIn, setActive } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = (type: ToastItem["type"], message: string) => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      if (!signIn) {
        pushToast("error", "Login service is not ready. Please retry.");
        return;
      }

      const result = await signIn?.create({
        identifier: email,
        password,
      });

      if (result?.status === "complete") {
        await setActive?.({ session: result.createdSessionId });
        await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "SIGN_IN" }),
        });
        pushToast("success", "Login successful.");
        router.push("/");
      } else {
        pushToast(
          "info",
          `Login requires extra verification step. Current status: ${result?.status ?? "unknown"}`,
        );
      }
    } catch (error: unknown) {
      pushToast("error", getErrorMessage(error, "Unable to login"));
    }

    setLoading(false);
  };

  return (
    <>
      <div className="fixed right-4 top-4 z-50">
        {toasts.map((toast) => (
          <Toast key={toast.id} id={toast.id} type={toast.type} message={toast.message} onClose={removeToast} />
        ))}
      </div>
      <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-md items-center px-4 py-10">
        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
          <h1 className="text-3xl font-black text-zinc-900">Welcome Back</h1>
          <p className="mt-2 text-sm text-zinc-600">Login using your email and password.</p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
              placeholder="you@example.com"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
              placeholder="••••••••"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <p className="mt-5 text-sm text-zinc-700">
            New user? <Link href="/register" className="font-semibold text-emerald-700">Create an account</Link>
          </p>
        </div>
      </main>
    </>
  );
}
