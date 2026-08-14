import { requireAuthProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

function shipmentStatusLabel(status: "ORDER_RECEIVED" | "ITEM_PACKED" | "ITEM_SHIPPED") {
  if (status === "ITEM_PACKED") return "Item packed";
  if (status === "ITEM_SHIPPED") return "Item shipped";
  return "Order received";
}

export default async function OrdersPage() {
  const profile = await requireAuthProfile();

  if (!profile) {
    return <div className="mx-auto max-w-6xl px-4 pb-10 pt-28">Unauthorized</div>;
  }

  const orders = await supabase.from("orders").select({
    where: { profileId: profile.id },
    include: {
      items: {
        include: {
          product: true,
          variation: {
            select: {
              label: true,
            },
          },
        },
      },
      payment: {
        select: {
          razorpayPaymentId: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-28">
      <h1 className="text-3xl font-black text-zinc-900">Orders</h1>
      <div className="mt-6 space-y-4">
        {orders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-zinc-600">No orders yet.</p>
        ) : (
          orders.map((order) => (
            <article key={order.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold text-zinc-900">Order #{order.id.slice(0, 8)}</h2>
                <p className="text-sm text-zinc-600">{new Date(order.createdAt).toLocaleString()}</p>
              </div>
              <div className="mt-2 flex items-center gap-3 text-sm">
                <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">{order.status}</span>
                <span className="font-semibold text-zinc-900">Rs. {order.totalInr}</span>
                {order.payment ? <span className="text-zinc-500">Payment: {order.payment.razorpayPaymentId}</span> : null}
              </div>

              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-sm font-semibold text-zinc-900">
                  Shipment Status: {shipmentStatusLabel(order.shipmentStatus)}
                </p>
                {order.shippedAt ? (
                  <p className="mt-1 text-xs text-zinc-600">Shipped at: {new Date(order.shippedAt).toLocaleString()}</p>
                ) : null}
                {order.shippingProvider ? (
                  <p className="mt-1 text-sm text-zinc-700">Postal Service: {order.shippingProvider}</p>
                ) : null}
                {order.shippingTrackingId ? (
                  <p className="mt-1 text-sm text-zinc-700">Tracking ID: {order.shippingTrackingId}</p>
                ) : null}
                {order.shippingInstructions ? (
                  <p className="mt-1 text-sm text-zinc-700">Track Instructions: {order.shippingInstructions}</p>
                ) : null}
                {order.shippingUrl ? (
                  <a
                    href={order.shippingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-semibold text-emerald-700"
                  >
                    Open postal tracking link
                  </a>
                ) : null}
              </div>

              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-sm font-semibold text-zinc-900">Shipping Address</p>
                <p className="mt-1 text-sm text-zinc-700">
                  {order.recipientName} ({order.recipientPhone})
                </p>
                <p className="text-sm text-zinc-700">
                  {order.addressLine1}
                  {order.addressLine2 ? `, ${order.addressLine2}` : ""}
                </p>
                <p className="text-sm text-zinc-700">
                  {order.city}, {order.state} - {order.postalCode}, {order.country}
                </p>
                {order.landmark ? <p className="text-sm text-zinc-700">Landmark: {order.landmark}</p> : null}
                {order.deliveryNotes ? <p className="text-sm text-zinc-700">Notes: {order.deliveryNotes}</p> : null}
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-zinc-900">Ordered Items</p>
                {order.items.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-500">No item details available for this order.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm text-zinc-700">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.product.name} ({item.variationLabel || item.variation?.label || "Standard"}) x {item.quantity} @ Rs. {item.unitPriceInr}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
