"use client";

import { useMemo, useState } from "react";
import Script from "next/script";

type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type CheckoutForm = {
  recipientName: string;
  recipientPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark: string;
  deliveryNotes: string;
};

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

const initialForm: CheckoutForm = {
  recipientName: "",
  recipientPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  landmark: "",
  deliveryNotes: "",
};

export default function CheckoutPage() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CheckoutForm>(initialForm);

  const isValid = useMemo(() => {
    return (
      form.recipientName.trim().length > 0 &&
      form.recipientPhone.trim().length >= 8 &&
      form.addressLine1.trim().length > 0 &&
      form.city.trim().length > 0 &&
      form.state.trim().length > 0 &&
      form.postalCode.trim().length >= 4
    );
  }, [form]);

  const checkout = async () => {
    if (!isValid) {
      alert("Please fill all required shipping fields");
      return;
    }

    setLoading(true);

    try {
      const createRes = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const createData = (await createRes.json()) as {
        error?: string;
        orderId: string;
        razorpayOrderId: string;
        amountPaise: number;
        currency: string;
        razorpayKeyId: string;
        prefill?: {
          name?: string;
          email?: string;
          contact?: string;
        };
      };

      if (!createRes.ok) {
        alert(createData.error ?? "Could not start checkout");
        setLoading(false);
        return;
      }

      const options = {
        key: createData.razorpayKeyId,
        amount: createData.amountPaise,
        currency: createData.currency,
        name: "LeafCart",
        description: "Plant order payment",
        order_id: createData.razorpayOrderId,
        prefill: createData.prefill,
        handler: async (response: RazorpayResponse) => {
          const verifyRes = await fetch("/api/checkout/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: createData.orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });

          if (verifyRes.ok) {
            window.location.href = "/orders";
            return;
          }

          const err = (await verifyRes.json()) as { error?: string };
          alert(err.error ?? "Payment verification failed");
        },
        theme: { color: "#047857" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch {
      alert("Checkout request failed");
    }

    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-black text-zinc-900">Secure Checkout</h1>
        <p className="mt-2 text-zinc-600">Enter shipping details before payment.</p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Recipient Name *"
            value={form.recipientName}
            onChange={(value) => setForm((prev) => ({ ...prev, recipientName: value }))}
          />
          <Input
            label="Recipient Phone *"
            value={form.recipientPhone}
            onChange={(value) => setForm((prev) => ({ ...prev, recipientPhone: value }))}
          />
          <Input
            label="Address Line 1 *"
            value={form.addressLine1}
            onChange={(value) => setForm((prev) => ({ ...prev, addressLine1: value }))}
          />
          <Input
            label="Address Line 2"
            value={form.addressLine2}
            onChange={(value) => setForm((prev) => ({ ...prev, addressLine2: value }))}
          />
          <Input label="City *" value={form.city} onChange={(value) => setForm((prev) => ({ ...prev, city: value }))} />
          <Input label="State *" value={form.state} onChange={(value) => setForm((prev) => ({ ...prev, state: value }))} />
          <Input
            label="Postal Code *"
            value={form.postalCode}
            onChange={(value) => setForm((prev) => ({ ...prev, postalCode: value }))}
          />
          <Input
            label="Country *"
            value={form.country}
            onChange={(value) => setForm((prev) => ({ ...prev, country: value }))}
          />
          <Input
            label="Landmark"
            value={form.landmark}
            onChange={(value) => setForm((prev) => ({ ...prev, landmark: value }))}
          />
          <label className="text-sm font-semibold text-zinc-700 md:col-span-2">
            Delivery Notes
            <textarea
              value={form.deliveryNotes}
              onChange={(event) => setForm((prev) => ({ ...prev, deliveryNotes: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3"
              rows={3}
              placeholder="Any delivery instruction for courier"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={checkout}
          disabled={loading || !isValid}
          className="mt-6 rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Starting payment..." : "Pay with Razorpay"}
        </button>
      </div>
    </div>
  );
}

function Input(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-zinc-700">
      {props.label}
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3"
      />
    </label>
  );
}
