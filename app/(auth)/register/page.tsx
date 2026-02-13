"use client";

import Link from "next/link";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Leaf, Lock, Mail, Phone, User } from "lucide-react";
import Toast from "@/app/components/ui/Toast";
import { getClerkErrorMessage } from "@/lib/clerkErrors";

type ToastItem = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

export default function RegisterPage() {
  const { signUp, setActive } = useSignUp();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = (type: ToastItem["type"], message: string) => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      pushToast("error", "Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      if (!signUp) {
        pushToast("error", "Signup service is not ready. Please retry.");
        return;
      }

      const result = await signUp.create({
        emailAddress: email,
        password,
        unsafeMetadata: { phone, fullName: fullName.trim() },
      });

      if (result?.status === "complete") {
        await setActive?.({ session: result.createdSessionId });
        await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "SIGN_UP" }),
        });
        pushToast("success", "Account created successfully.");
        router.push("/");
      } else if (result?.status === "missing_requirements") {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setPendingVerification(true);
        pushToast("info", "Verification code sent to your email.");
      } else {
        pushToast(
          "info",
          `Signup needs additional step. Current status: ${result?.status ?? "unknown"}`,
        );
      }
    } catch (error: unknown) {
      pushToast("error", getClerkErrorMessage(error, "Unable to register"));
    }

    setLoading(false);
  };

  const verifyEmailCode = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!signUp) {
      pushToast("error", "Signup service is not ready. Please retry.");
      return;
    }

    if (!verificationCode.trim()) {
      pushToast("error", "Please enter verification code.");
      return;
    }

    setVerifying(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (result.status === "complete") {
        await setActive?.({ session: result.createdSessionId });
        await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "SIGN_UP" }),
        });
        pushToast("success", "Email verified. Account created.");
        router.push("/");
      } else {
        pushToast("info", `Verification pending. Current status: ${result.status}`);
      }
    } catch (error: unknown) {
      pushToast("error", getClerkErrorMessage(error, "Invalid verification code"));
    }

    setVerifying(false);
  };

  const resendVerificationCode = async () => {
    if (!signUp) {
      pushToast("error", "Signup service is not ready. Please retry.");
      return;
    }

    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      pushToast("success", "Verification code resent.");
    } catch (error: unknown) {
      pushToast("error", getClerkErrorMessage(error, "Could not resend code"));
    }
  };

  return (
    <>
      <div className="fixed right-4 top-4 z-50">
        {toasts.map((toast) => (
          <Toast key={toast.id} id={toast.id} type={toast.type} message={toast.message} onClose={removeToast} />
        ))}
      </div>
      <main className="min-h-[calc(100vh-72px)] lg:min-h-[calc(100vh-72px)]">
        <div className="flex min-h-[calc(100vh-72px)]">
          <section className="order-2 flex w-full items-center justify-center bg-zinc-50 p-8 lg:order-1 lg:w-1/2">
            <div className="w-full max-w-md">
              <div className="mb-10 text-center lg:hidden">
                <Leaf size={48} className="mx-auto mb-4 text-emerald-600" />
                <h2 className="text-3xl font-bold text-emerald-900">Kerala Kissan Kendra</h2>
              </div>

              <h1 className="mb-2 text-3xl font-bold text-zinc-800">
                {pendingVerification ? "Verify Email" : "Create Account"}
              </h1>
              <p className="mb-8 text-zinc-500">
                {pendingVerification
                  ? "Enter the code sent to your email to complete signup."
                  : "Join our community of plant lovers."}
              </p>

              {!pendingVerification ? (
                <form className="space-y-4" onSubmit={submit}>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 text-zinc-400" size={18} />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="w-full rounded-lg border border-zinc-200 py-3 pl-10 pr-4 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      placeholder="Full Name"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 text-zinc-400" size={18} />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="w-full rounded-lg border border-zinc-200 py-3 pl-10 pr-4 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      placeholder="Phone Number"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 text-zinc-400" size={18} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full rounded-lg border border-zinc-200 py-3 pl-10 pr-4 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      placeholder="Email Address"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-zinc-400" size={18} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full rounded-lg border border-zinc-200 py-3 pl-10 pr-4 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      placeholder="Password"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-zinc-400" size={18} />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="w-full rounded-lg border border-zinc-200 py-3 pl-10 pr-4 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      placeholder="Confirm Password"
                    />
                  </div>
                  <div id="clerk-captcha" />
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-4 w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? "Creating account..." : "Register"}
                  </button>
                </form>
              ) : (
                <form className="space-y-4" onSubmit={verifyEmailCode}>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 text-zinc-400" size={18} />
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value)}
                      className="w-full rounded-lg border border-zinc-200 py-3 pl-10 pr-4 tracking-[0.3em] outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      placeholder="Enter code"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={verifying}
                    className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {verifying ? "Verifying..." : "Verify and Create Account"}
                  </button>
                  <button
                    type="button"
                    onClick={resendVerificationCode}
                    className="w-full rounded-lg border border-zinc-300 px-4 py-3 font-semibold text-zinc-800 hover:bg-zinc-100"
                  >
                    Resend Code
                  </button>
                </form>
              )}

              <p className="mt-6 text-center text-sm text-zinc-600">
                Already have an account?{" "}
                <Link href="/login" className="font-bold text-emerald-600 hover:underline">
                  Login here
                </Link>
              </p>
            </div>
          </section>

          <section className="relative order-1 hidden w-1/2 items-center justify-center overflow-hidden bg-emerald-100 lg:flex lg:order-2">
            <div className="absolute inset-0 z-0">
              <img
                src="https://images.unsplash.com/photo-1470058869958-2a77ade41c02?q=80&w=2070&auto=format&fit=crop"
                alt="Nature"
                className="h-full w-full object-cover opacity-80"
              />
            </div>
            <div className="relative z-10 max-w-lg p-12 text-white">
              <Leaf size={64} className="mb-8 text-emerald-900" />
              <h2 className="mb-6 text-5xl font-bold text-emerald-900">Join the Movement</h2>
              <p className="text-xl font-medium leading-relaxed text-emerald-900">
                Be part of a community that cares about nature. Get exclusive access to rare plants and gardening tips.
              </p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
