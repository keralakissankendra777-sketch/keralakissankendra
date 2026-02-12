"use client";

import { useMemo, useState } from "react";
import Toast from "@/app/components/ui/Toast";

type ProductImage = {
  id: string;
  url: string;
  sortOrder: number;
};

type Product = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  images: ProductImage[];
  priceInr: number;
  stock: number;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  category: {
    name: string;
  };
};

type Order = {
  id: string;
  totalInr: number;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  createdAt: string | Date;
  recipientName: string;
  recipientPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark: string | null;
  deliveryNotes: string | null;
  shippedAt: string | Date | null;
  shippingProvider: string | null;
  shippingTrackingId: string | null;
  shippingInstructions: string | null;
  shippingUrl: string | null;
  profile: {
    email: string;
    fullName: string | null;
  };
  items: Array<{
    id: string;
    quantity: number;
    unitPriceInr: number;
    product: {
      name: string;
    };
  }>;
};

type Props = {
  initialProducts: Product[];
  initialOrders: Order[];
  initialOrderPage: number;
  initialTotalOrders: number;
  pageSize: number;
};

type ProductPayload = {
  name: string;
  description: string;
  imageUrls: string[];
  priceInr: number;
  stock: number;
  categoryName: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
};

type TrackingDraft = {
  status: Order["status"];
  shippingProvider: string;
  shippingTrackingId: string;
  shippingInstructions: string;
  shippingUrl: string;
  markShipped: boolean;
};

type ToastItem = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

const emptyForm: ProductPayload = {
  name: "",
  description: "",
  imageUrls: [],
  priceInr: 0,
  stock: 0,
  categoryName: "",
  status: "ACTIVE",
};

function createTrackingDrafts(rows: Order[]) {
  return rows.reduce<Record<string, TrackingDraft>>((acc, row) => {
    acc[row.id] = {
      status: row.status,
      shippingProvider: row.shippingProvider ?? "",
      shippingTrackingId: row.shippingTrackingId ?? "",
      shippingInstructions: row.shippingInstructions ?? "",
      shippingUrl: row.shippingUrl ?? "",
      markShipped: Boolean(row.shippedAt),
    };
    return acc;
  }, {});
}

export default function AdminDashboardClient({
  initialProducts,
  initialOrders,
  initialOrderPage,
  initialTotalOrders,
  pageSize,
}: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [form, setForm] = useState<ProductPayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(initialOrderPage);
  const [totalOrders, setTotalOrders] = useState(initialTotalOrders);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, TrackingDraft>>(() => createTrackingDrafts(initialOrders));
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));

  const pushToast = (type: ToastItem["type"], message: string) => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const metrics = useMemo(() => {
    const revenue = orders.filter((order) => order.status === "PAID").reduce((sum, order) => sum + order.totalInr, 0);
    const pending = orders.filter((order) => order.status === "PENDING").length;
    return {
      productCount: products.length,
      orderCount: totalOrders,
      revenue,
      pending,
    };
  }, [products, orders, totalOrders]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description,
      imageUrls: product.images.length > 0 ? product.images.map((img) => img.url) : [product.imageUrl],
      priceInr: product.priceInr,
      stock: product.stock,
      categoryName: product.category.name,
      status: product.status,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const refreshProducts = async () => {
    const refreshRes = await fetch("/api/admin/products", { cache: "no-store" });
    if (refreshRes.ok) {
      const refreshData = (await refreshRes.json()) as { products: Product[] };
      setProducts(refreshData.products);
    }
  };

  const fetchOrdersPage = async (page: number) => {
    setOrdersLoading(true);
    try {
      const res = await fetch(`/api/admin/orders?page=${page}&pageSize=${pageSize}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        pushToast("error", data.error ?? "Could not load orders");
        return;
      }

      const data = (await res.json()) as {
        orders: Order[];
        page: number;
        total: number;
      };
      setOrders(data.orders);
      setCurrentPage(data.page);
      setTotalOrders(data.total);
      setTrackingDrafts(createTrackingDrafts(data.orders));
    } catch {
      pushToast("error", "Could not load orders");
    }

    setOrdersLoading(false);
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    setUploading(true);
    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append("files", file);
    }

    const res = await fetch("/api/admin/uploads", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      pushToast("error", data.error ?? "Upload failed");
      setUploading(false);
      return;
    }

    const data = (await res.json()) as { uploaded: Array<{ url: string }> };
    setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, ...data.uploaded.map((item) => item.url)] }));
    pushToast("success", "Images uploaded.");
    setUploading(false);
  };

  const removeImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const url = editingId ? `/api/admin/products/${editingId}` : "/api/admin/products";
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      pushToast("error", data.error ?? "Save failed");
      setSaving(false);
      return;
    }

    await refreshProducts();
    setSaving(false);
    closeModal();
    pushToast("success", editingId ? "Product updated." : "Product created.");
  };

  const deleteProduct = async (id: string) => {
    const ok = window.confirm("Delete this product?");
    if (!ok) {
      return;
    }

    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      pushToast("error", data.error ?? "Delete failed");
      return;
    }

    setProducts((prev) => prev.filter((row) => row.id !== id));
    pushToast("success", "Product deleted.");
  };

  const updateTrackingDraft = (orderId: string, patch: Partial<TrackingDraft>) => {
    setTrackingDrafts((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        ...patch,
      },
    }));
  };

  const saveOrderTracking = async (orderId: string) => {
    const draft = trackingDrafts[orderId];
    if (!draft) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        pushToast("error", data.error ?? "Tracking update failed");
        return;
      }

      const data = (await res.json()) as {
        order: Order;
      };

      setOrders((prev) => prev.map((row) => (row.id === orderId ? data.order : row)));
      setTrackingDrafts((prev) => ({
        ...prev,
        [orderId]: {
          status: data.order.status,
          shippingProvider: data.order.shippingProvider ?? "",
          shippingTrackingId: data.order.shippingTrackingId ?? "",
          shippingInstructions: data.order.shippingInstructions ?? "",
          shippingUrl: data.order.shippingUrl ?? "",
          markShipped: Boolean(data.order.shippedAt),
        },
      }));
      pushToast("success", "Tracking details saved.");
    } catch {
      pushToast("error", "Tracking update failed");
    }
  };

  return (
    <>
      <div className="fixed right-4 top-4 z-50">
        {toasts.map((toast) => (
          <Toast key={toast.id} id={toast.id} type={toast.type} message={toast.message} onClose={removeToast} />
        ))}
      </div>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Products" value={metrics.productCount} />
        <MetricCard label="Orders" value={metrics.orderCount} />
        <MetricCard label="Revenue (INR)" value={metrics.revenue} />
        <MetricCard label="Pending" value={metrics.pending} />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">Products</h2>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Add Product
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {products.map((product) => (
            <article key={product.id} className="rounded-xl border border-zinc-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={product.images[0]?.url ?? product.imageUrl}
                    alt={product.name}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div>
                    <h3 className="font-bold text-zinc-900">{product.name}</h3>
                    <p className="text-sm text-zinc-600">{product.category.name}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-zinc-900">Rs. {product.priceInr}</p>
              </div>
              <p className="mt-2 text-sm text-zinc-600">{product.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                <span>Status: {product.status}</span>
                <span>Stock: {product.stock}</span>
                <span>Images: {product.images.length}</span>
              </div>
              <div className="mt-3 flex gap-3">
                <button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => openEditModal(product)}>
                  Edit
                </button>
                <button type="button" className="text-sm font-semibold text-rose-600" onClick={() => deleteProduct(product.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">Orders</h2>
          <p className="text-sm text-zinc-600">
            Page {currentPage} of {totalPages}
          </p>
        </div>
        <div className="mt-4 space-y-3">
          {ordersLoading ? (
            <p className="text-sm text-zinc-600">Loading orders...</p>
          ) : (
            orders.map((order) => {
              const trackingDraft = trackingDrafts[order.id];

              return (
                <article key={order.id} className="rounded-xl border border-zinc-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-zinc-900">Order #{order.id.slice(0, 8)}</h3>
                      <p className="text-sm text-zinc-600">
                        {order.profile?.fullName ?? order.profile?.email ?? "Unknown customer"}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900">Rs. {order.totalInr}</p>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">{new Date(order.createdAt).toLocaleString()}</p>
                  <p className="mt-1 text-sm text-zinc-700">
                    Ship to: {order.recipientName}, {order.addressLine1}
                    {order.addressLine2 ? `, ${order.addressLine2}` : ""}, {order.city}, {order.state} {order.postalCode}
                  </p>
                  <p className="text-xs text-zinc-600">Phone: {order.recipientPhone}</p>

                  <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ordered Items</p>
                    {order.items.length === 0 ? (
                      <p className="mt-1 text-xs text-zinc-500">No item details found for this order.</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-xs text-zinc-700">
                        {order.items.map((item) => (
                          <li key={item.id}>
                            {item.product.name} x {item.quantity} @ Rs. {item.unitPriceInr}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 md:grid-cols-2">
                    <label className="text-xs font-semibold text-zinc-700">
                      Status
                      <select
                        value={trackingDraft?.status ?? order.status}
                        onChange={(event) =>
                          updateTrackingDraft(order.id, { status: event.target.value as Order["status"] })
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="PAID">PAID</option>
                        <option value="FAILED">FAILED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </label>

                    <label className="text-xs font-semibold text-zinc-700">
                      Postal Service
                      <input
                        value={trackingDraft?.shippingProvider ?? ""}
                        onChange={(event) => updateTrackingDraft(order.id, { shippingProvider: event.target.value })}
                        className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                        placeholder="India Post / DHL / Delhivery"
                      />
                    </label>

                    <label className="text-xs font-semibold text-zinc-700">
                      Postal Tracking ID
                      <input
                        value={trackingDraft?.shippingTrackingId ?? ""}
                        onChange={(event) => updateTrackingDraft(order.id, { shippingTrackingId: event.target.value })}
                        className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                        placeholder="Consignment ID"
                      />
                    </label>

                    <label className="text-xs font-semibold text-zinc-700">
                      Tracking URL (optional)
                      <input
                        value={trackingDraft?.shippingUrl ?? ""}
                        onChange={(event) => updateTrackingDraft(order.id, { shippingUrl: event.target.value })}
                        className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                        placeholder="https://..."
                      />
                    </label>

                    <label className="text-xs font-semibold text-zinc-700 md:col-span-2">
                      Customer Tracking Instructions
                      <textarea
                        value={trackingDraft?.shippingInstructions ?? ""}
                        onChange={(event) => updateTrackingDraft(order.id, { shippingInstructions: event.target.value })}
                        className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                        rows={2}
                        placeholder="Use postal website and enter tracking ID..."
                      />
                    </label>

                    <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700 md:col-span-2">
                      <input
                        type="checkbox"
                        checked={trackingDraft?.markShipped ?? false}
                        onChange={(event) => updateTrackingDraft(order.id, { markShipped: event.target.checked })}
                      />
                      Mark order as shipped
                    </label>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => saveOrderTracking(order.id)}
                      className="rounded-lg bg-emerald-700 px-3 py-1 text-sm font-semibold text-white"
                    >
                      Save Tracking
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => fetchOrdersPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || ordersLoading}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm disabled:opacity-60"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => fetchOrdersPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages || ordersLoading}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-black">{editingId ? "Edit Product" : "Add Product"}</h2>
              <button type="button" onClick={closeModal} className="text-sm font-semibold text-zinc-500">
                Close
              </button>
            </div>

            <form onSubmit={saveProduct} className="space-y-3">
              <Input label="Name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
              <Input
                label="Description"
                value={form.description}
                onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
              />
              <Input label="Category" value={form.categoryName} onChange={(value) => setForm((prev) => ({ ...prev, categoryName: value }))} />
              <Input
                label="Price INR"
                type="number"
                value={String(form.priceInr)}
                onChange={(value) => setForm((prev) => ({ ...prev, priceInr: Number(value) }))}
              />
              <Input
                label="Stock"
                type="number"
                value={String(form.stock)}
                onChange={(value) => setForm((prev) => ({ ...prev, stock: Number(value) }))}
              />

              <label className="block text-sm font-semibold text-zinc-700">
                Status
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, status: event.target.value as ProductPayload["status"] }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </label>

              <label className="block text-sm font-semibold text-zinc-700">
                Product Images (multiple)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => void uploadFiles(event.target.files)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </label>
              {uploading ? <p className="text-xs text-zinc-500">Uploading images...</p> : null}
              {form.imageUrls.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {form.imageUrls.map((url, index) => (
                    <div key={url} className="relative overflow-hidden rounded-lg border border-zinc-200">
                      <img src={url} alt={`Product preview ${index + 1}`} className="h-24 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute right-1 top-1 rounded bg-black/70 px-2 py-1 text-xs text-white"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                >
                  {saving ? "Saving..." : editingId ? "Update Product" : "Create Product"}
                </button>
                <button type="button" onClick={closeModal} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      </div>
    </>
  );
}

function Input(props: {
  label: string;
  value: string;
  type?: "text" | "number";
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-zinc-700">
      {props.label}
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
      />
    </label>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-zinc-900">{value}</p>
    </article>
  );
}
