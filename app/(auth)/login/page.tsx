"use client";

import Link from "next/link";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Leaf } from "lucide-react";
import Toast from "@/app/components/ui/Toast";
import { getClerkErrorMessage } from "@/lib/clerkErrors";

type ToastItem = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

export default function LoginPage() {
  const { signIn, setActive } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [secondFactorRequired, setSecondFactorRequired] = useState(false);
  const [secondFactorStrategy, setSecondFactorStrategy] = useState<"totp" | "email_code">("totp");
  const [otp, setOtp] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const previousOtpLength = useRef(0);

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
        return;
      }

      if (result?.status === "needs_second_factor") {
        const supportedFactors = (result as any).supportedSecondFactors ?? [];
        const emailFactor = supportedFactors.find(
          (factor: any) => factor.strategy === "email_code",
        );

        if (emailFactor) {
          setSecondFactorStrategy("email_code");
          await signIn.prepareSecondFactor({ strategy: "email_code" });
          setSecondFactorRequired(true);
          pushToast(
            "info",
            `Enter the code sent to ${emailFactor.emailAddress ?? "your email"}.`,
          );
        } else {
          setSecondFactorStrategy("totp");
          setSecondFactorRequired(true);
          pushToast("info", "Enter the code from your authenticator app.");
        }
        setLoading(false);
        return;
      }

      pushToast(
        "info",
        `Login requires an extra step. Current status: ${result?.status ?? "unknown"}`,
      );
    } catch (error: unknown) {
      pushToast("error", getClerkErrorMessage(error, "Unable to login"));
    }

    setLoading(false);
  };

  const runSecondFactor = async (code: string) => {
    if (loading || !signIn) {
      return;
    }

    setLoading(true);

    try {
      const result = await signIn.attemptSecondFactor({
        strategy: secondFactorStrategy,
        code: code.trim(),
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
        return;
      }

      setOtp("");
      previousOtpLength.current = 0;
      pushToast(
        "info",
        `Verification needs another step. Current status: ${result?.status ?? "unknown"}`,
      );
    } catch (error: unknown) {
      setOtp("");
      previousOtpLength.current = 0;
      pushToast("error", getClerkErrorMessage(error, "Unable to verify code"));
    }

    setLoading(false);
  };

  const submitSecondFactor = (event: React.FormEvent) => {
    event.preventDefault();
    void runSecondFactor(otp);
  };

  useEffect(() => {
    if (otp.length === 6 && previousOtpLength.current < 6 && !loading) {
      void runSecondFactor(otp);
    }
    previousOtpLength.current = otp.length;
  }, [otp, loading]);

  return (
    <>
      <div className="fixed right-4 top-4 z-50">
        {toasts.map((toast) => (
          <Toast key={toast.id} id={toast.id} type={toast.type} message={toast.message} onClose={removeToast} />
        ))}
      </div>
      <main className="min-h-[calc(100vh-72px)]">
        <div className="flex min-h-[calc(100vh-72px)]">
          <section className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-emerald-900 lg:flex">
            <div className="absolute inset-0 z-0">
              <img
                src="https://images.unsplash.com/photo-1470058869958-2a77ade41c02?q=80&w=2070&auto=format&fit=crop"
                alt="Plant"
                className="h-full w-full object-cover opacity-60"
              />
            </div>
            <div className="relative z-10 max-w-lg p-12 text-white">
              <Leaf size={64} className="mb-8 text-emerald-300" />
              <h1 className="mb-6 text-5xl font-bold">Welcome Back</h1>
              <p className="text-xl leading-relaxed text-emerald-100">
                Continue your journey to a greener home. Sign in to access your saved plants and order history.
              </p>
            </div>
          </section>

          <section className="flex w-full items-center justify-center bg-zinc-50 p-8 lg:w-1/2">
            <div className="w-full max-w-md">
              <div className="mb-10 text-center lg:hidden">
                <Leaf size={48} className="mx-auto mb-4 text-emerald-600" />
                <h2 className="text-3xl font-bold text-emerald-900">Kerala Kissan Kendra</h2>
              </div>

              <h2 className="mb-2 text-3xl font-bold text-zinc-800">Sign In</h2>
              <p className="mb-8 text-zinc-500">Enter your details to access your account.</p>

              {secondFactorRequired ? (
                <form className="space-y-6" onSubmit={submitSecondFactor}>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-zinc-700">
                      {secondFactorStrategy === "email_code"
                        ? "Verification code (sent to your email)"
                        : "Authenticator app code"}
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                      className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      placeholder="••••••"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white shadow-lg shadow-green-600/30 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? "Verifying..." : "Verify"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSecondFactorRequired(false);
                      setOtp("");
                    }}
                    className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                  >
                    Back to sign in
                  </button>
                </form>
              ) : (
                <form className="space-y-6" onSubmit={submit}>
                <div>
                  <label className="mb-2 block text-sm font-bold text-zinc-700">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-bold text-zinc-700">Password</label>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white shadow-lg shadow-green-600/30 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>
              )}

              <p className="mt-8 text-center text-sm text-zinc-500">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="font-bold text-emerald-600 hover:underline">
                  Create an account
                </Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
