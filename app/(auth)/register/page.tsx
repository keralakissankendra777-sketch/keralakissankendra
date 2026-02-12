"use client";

import Link from "next/link";
import { useSignUp } from "@clerk/nextjs";
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

      const parts = fullName.trim().split(" ");
      const firstName = parts[0] ?? "";
      const lastName = parts.slice(1).join(" ");

      const result = await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
        unsafeMetadata: { phone },
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
      pushToast("error", getErrorMessage(error, "Unable to register"));
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
      pushToast("error", getErrorMessage(error, "Invalid verification code"));
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
      pushToast("error", getErrorMessage(error, "Could not resend code"));
    }
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
          <h1 className="text-3xl font-black text-zinc-900">
            {pendingVerification ? "Verify Email" : "Create Account"}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            {pendingVerification
              ? "Enter the code sent to your email to complete signup."
              : "Sign up to start shopping securely."}
          </p>
          {!pendingVerification ? (
            <form className="mt-6 space-y-4" onSubmit={submit}>
              <input
                type="text"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-4 py-3"
                placeholder="Full Name"
              />
              <input
                type="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-4 py-3"
                placeholder="Phone"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-4 py-3"
                placeholder="Email"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-4 py-3"
                placeholder="Password"
              />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-4 py-3"
                placeholder="Confirm password"
              />
              <div id="clerk-captcha" />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Creating account..." : "Register"}
              </button>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={verifyEmailCode}>
              <input
                type="text"
                inputMode="numeric"
                required
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 tracking-[0.3em]"
                placeholder="Enter code"
              />
              <button
                type="submit"
                disabled={verifying}
                className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {verifying ? "Verifying..." : "Verify and Create Account"}
              </button>
              <button
                type="button"
                onClick={resendVerificationCode}
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Resend Code
              </button>
            </form>
          )}
          <p className="mt-5 text-sm text-zinc-700">
            Already have an account? <Link href="/login" className="font-semibold text-emerald-700">Login</Link>
          </p>
        </div>
      </main>
    </>
  );
}
