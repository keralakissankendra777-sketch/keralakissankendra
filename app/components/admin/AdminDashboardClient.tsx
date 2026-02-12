"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Image as ImageIcon,
  Package,
  RefreshCw,
  Upload,
} from "lucide-react";
import Toast from "@/app/components/ui/Toast";
import ConfirmationModal from "@/app/components/ui/ConfirmationModal";
import {
  DEFAULT_CATEGORY_VALUES,
  DEFAULT_POT_SIZE_VALUES,
  normalizeCategoryLabel,
  normalizePotSizeLabel,
} from "@/lib/catalog";

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
  potSize: string;
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
  potSize: string;
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

type ModalConfig = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
};

const emptyForm: ProductPayload = {
  name: "",
  description: "",
  imageUrls: [],
  priceInr: 0,
  stock: 0,
  categoryName: "Indoor",
  potSize: "Medium",
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

function normalizeImageUrl(url: string) {
  return url.replace("http://minio:9000/", "http://localhost:9000/");
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
  const [localImagePreviews, setLocalImagePreviews] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState(initialOrderPage);
  const [totalOrders, setTotalOrders] = useState(initialTotalOrders);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, TrackingDraft>>(() => createTrackingDrafts(initialOrders));
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isAddingPotSize, setIsAddingPotSize] = useState(false);
  const [newPotSizeName, setNewPotSizeName] = useState("");
  const [customPotSizes, setCustomPotSizes] = useState<string[]>([]);

  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));

  const categories = useMemo(() => {
    const fromProducts = products
      .map((product) => normalizeCategoryLabel(product.category.name))
      .filter(Boolean);

    return [...new Set([...DEFAULT_CATEGORY_VALUES, ...fromProducts, ...customCategories])];
  }, [products, customCategories]);

  const potSizes = useMemo(() => {
    const fromProducts = products.map((product) => normalizePotSizeLabel(product.potSize)).filter(Boolean);

    return [...new Set([...DEFAULT_POT_SIZE_VALUES, ...fromProducts, ...customPotSizes])];
  }, [products, customPotSizes]);

  const previewUrls = useMemo(() => {
    return [...localImagePreviews, ...form.imageUrls];
  }, [localImagePreviews, form.imageUrls]);

  const pushToast = (type: ToastItem["type"], message: string) => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIsAddingCategory(false);
    setNewCategoryName("");
    setIsAddingPotSize(false);
    setNewPotSizeName("");
    setLocalImagePreviews([]);
  };

  useEffect(() => {
    return () => {
      for (const url of localImagePreviews) {
        URL.revokeObjectURL(url);
      }
    };
  }, [localImagePreviews]);

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description,
      imageUrls: product.images.length > 0 ? product.images.map((img) => img.url) : [product.imageUrl],
      priceInr: product.priceInr,
      stock: product.stock,
      categoryName: normalizeCategoryLabel(product.category.name),
      potSize: normalizePotSizeLabel(product.potSize) || "Medium",
      status: product.status,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      const res = await fetch(`/api/admin/orders?page=${page}&pageSize=${pageSize}`, { cache: "no-store" });

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
    for (const url of localImagePreviews) {
      URL.revokeObjectURL(url);
    }
    setLocalImagePreviews([]);
    pushToast("success", "Images uploaded.");
    setUploading(false);
  };

  const handleImageSelect = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const previewUrls = Array.from(files).map((file) => URL.createObjectURL(file));
    setLocalImagePreviews((prev) => [...prev, ...previewUrls]);
    void uploadFiles(files);
  };

  const removeImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedCategory = normalizeCategoryLabel(form.categoryName);
    const normalizedPotSize = normalizePotSizeLabel(form.potSize);

    if (!form.name.trim() || !normalizedCategory || form.priceInr <= 0 || form.stock < 0 || !normalizedPotSize) {
      pushToast("error", "Please fill all required fields.");
      return;
    }

    if (form.imageUrls.length === 0) {
      pushToast("error", "Upload at least one product image.");
      return;
    }

    setSaving(true);

    const url = editingId ? `/api/admin/products/${editingId}` : "/api/admin/products";
    const method = editingId ? "PATCH" : "POST";

    const payload: ProductPayload = {
      ...form,
      categoryName: normalizedCategory,
      potSize: normalizedPotSize,
    };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      pushToast("error", data.error ?? "Save failed");
      setSaving(false);
      return;
    }

    await refreshProducts();
    setSaving(false);
    resetForm();
    pushToast("success", editingId ? "Product updated." : "Product created.");
  };

  const deleteProduct = async (id: string) => {
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

      const data = (await res.json()) as { order: Order };

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
      pushToast("success", "Order updated.");
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

      <div className="min-h-screen bg-zinc-50 pb-12 pt-28">
        <div className="container mx-auto px-6">
          <h1 className="mb-8 text-4xl font-bold text-emerald-900">Admin Dashboard</h1>

          <div className="grid gap-8 lg:grid-cols-2">
            <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
              <h2 className="mb-6 flex items-center justify-between gap-2 text-2xl font-bold text-zinc-800">
                <span className="flex items-center gap-2">
                  <Upload size={24} className="text-emerald-600" />
                  {editingId ? "Edit Product" : "Add New Product"}
                </span>
                {editingId ? (
                  <button type="button" onClick={resetForm} className="text-sm font-bold text-red-500 hover:underline">
                    Cancel Edit
                  </button>
                ) : null}
              </h2>

              <form onSubmit={saveProduct} className="space-y-4">
                <Input label="Product Name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block text-sm font-bold text-zinc-700">Category</label>
                      <button
                        type="button"
                        onClick={() => setIsAddingCategory((prev) => !prev)}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-800"
                      >
                        {isAddingCategory ? "Cancel" : "+ Add New"}
                      </button>
                    </div>

                    {isAddingCategory ? (
                      <div className="flex gap-2">
                        <input
                          value={newCategoryName}
                          onChange={(event) => setNewCategoryName(event.target.value)}
                          className="w-full rounded-lg border border-zinc-300 p-3"
                          placeholder="New Category"
                        />
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-600 px-3 text-white hover:bg-emerald-700"
                          onClick={() => {
                            const next = normalizeCategoryLabel(newCategoryName);
                            if (!next) return;
                            setCustomCategories((prev) => [...new Set([...prev, next])]);
                            setForm((prev) => ({ ...prev, categoryName: next }));
                            setNewCategoryName("");
                            setIsAddingCategory(false);
                          }}
                        >
                          <CheckCircle size={18} />
                        </button>
                      </div>
                    ) : (
                      <select
                        value={form.categoryName}
                        onChange={(event) => setForm((prev) => ({ ...prev, categoryName: event.target.value }))}
                        className="w-full rounded-lg border border-zinc-300 p-3"
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <Input
                    label="Base Price (Rs)"
                    type="number"
                    value={String(form.priceInr || "")}
                    onChange={(value) => setForm((prev) => ({ ...prev, priceInr: Number(value || 0) }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block text-sm font-bold text-zinc-700">Default Pot Size</label>
                      <button
                        type="button"
                        onClick={() => setIsAddingPotSize((prev) => !prev)}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-800"
                      >
                        {isAddingPotSize ? "Cancel" : "+ Add New"}
                      </button>
                    </div>

                    {isAddingPotSize ? (
                      <div className="flex gap-2">
                        <input
                          value={newPotSizeName}
                          onChange={(event) => setNewPotSizeName(event.target.value)}
                          className="w-full rounded-lg border border-zinc-300 p-3"
                          placeholder="New Pot Size"
                        />
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-600 px-3 text-white hover:bg-emerald-700"
                          onClick={() => {
                            const next = normalizePotSizeLabel(newPotSizeName);
                            if (!next) return;
                            setCustomPotSizes((prev) => [...new Set([...prev, next])]);
                            setForm((prev) => ({ ...prev, potSize: next }));
                            setNewPotSizeName("");
                            setIsAddingPotSize(false);
                          }}
                        >
                          <CheckCircle size={18} />
                        </button>
                      </div>
                    ) : (
                      <select
                        value={form.potSize}
                        onChange={(event) => setForm((prev) => ({ ...prev, potSize: event.target.value }))}
                        className="w-full rounded-lg border border-zinc-300 p-3"
                      >
                        {potSizes.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <Input
                    label="Stock"
                    type="number"
                    value={String(form.stock || "")}
                    onChange={(value) => setForm((prev) => ({ ...prev, stock: Number(value || 0) }))}
                  />
                </div>

                <label className="block text-sm font-bold text-zinc-700">
                  Description
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="mt-1 h-24 w-full rounded-lg border border-zinc-300 p-3"
                    placeholder="Product details..."
                  />
                </label>

                <label className="block text-sm font-bold text-zinc-700">
                  Product Images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => handleImageSelect(event.target.files)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </label>

                {uploading ? <p className="text-xs text-zinc-500">Uploading images...</p> : null}
                {previewUrls.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {previewUrls.map((url, index) => (
                      <div key={`${url}-${index}`} className="relative overflow-hidden rounded-lg border border-zinc-200">
                        <img src={normalizeImageUrl(url)} alt={`Product preview ${index + 1}`} className="h-24 w-full object-cover" />
                        {form.imageUrls.includes(url) ? (
                          <button
                            type="button"
                            onClick={() => removeImage(form.imageUrls.indexOf(url))}
                            className="absolute right-1 top-1 rounded bg-black/70 px-2 py-1 text-xs text-white"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-zinc-300 p-5 text-center text-zinc-400">
                    <ImageIcon size={22} className="mx-auto mb-2" />
                    Add one or more product images.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-2 w-full rounded-lg bg-emerald-700 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-70"
                >
                  {saving ? "Processing..." : editingId ? "Update Product" : "Add Product"}
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-2xl font-bold text-zinc-800">
                  <Package size={24} className="text-emerald-600" /> Incoming Orders
                </h2>
                <button
                  type="button"
                  onClick={() => fetchOrdersPage(currentPage)}
                  className="rounded-full p-2 text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <RefreshCw size={20} />
                </button>
              </div>

              <div className="max-h-[640px] space-y-4 overflow-y-auto pr-2">
                {ordersLoading ? <p className="text-sm text-zinc-500">Loading orders...</p> : null}
                {!ordersLoading && orders.length === 0 ? (
                  <div className="py-10 text-center text-zinc-400">
                    <Package size={40} className="mx-auto mb-2 opacity-40" />
                    No orders yet.
                  </div>
                ) : null}

                {orders.map((order) => {
                  const draft = trackingDrafts[order.id];

                  return (
                    <article key={order.id} className="rounded-xl border border-zinc-100 bg-white p-5 shadow-sm">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-emerald-900">
                            {order.profile?.fullName ?? order.profile?.email ?? "Customer"}
                          </h3>
                          <p className="text-sm text-zinc-500">{order.recipientPhone || "No phone"}</p>
                        </div>
                        <select
                          value={draft?.status ?? order.status}
                          onChange={(event) => updateTrackingDraft(order.id, { status: event.target.value as Order["status"] })}
                          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-bold"
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="PAID">PAID</option>
                          <option value="FAILED">FAILED</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
                      </div>

                      <div className="mb-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
                        {order.addressLine1}
                        {order.addressLine2 ? `, ${order.addressLine2}` : ""}, {order.city}, {order.state} {order.postalCode}
                      </div>

                      <div className="mb-4 space-y-1">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex justify-between border-b border-dashed border-zinc-100 py-1 text-sm">
                            <span className="font-medium text-zinc-700">
                              {item.product.name} <span className="font-normal text-zinc-400">x{item.quantity}</span>
                            </span>
                            <span className="font-bold text-zinc-900">Rs {item.unitPriceInr * item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between border-t border-zinc-100 pt-3 font-bold">
                        <span className="text-zinc-600">Total Amount</span>
                        <span className="text-xl text-emerald-700">Rs {order.totalInr}</span>
                      </div>

                      <div className="mt-4 border-t border-zinc-100 pt-4">
                        <label className="mb-1 block text-xs font-bold text-zinc-500">Tracking ID / Courier</label>
                        <div className="flex gap-2">
                          <input
                            value={draft?.shippingTrackingId ?? ""}
                            onChange={(event) => updateTrackingDraft(order.id, { shippingTrackingId: event.target.value })}
                            placeholder="Enter Tracking ID..."
                            className="flex-1 rounded border border-zinc-300 p-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => saveOrderTracking(order.id)}
                            className="rounded bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
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
          </div>

          <section className="mt-12 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-zinc-800">
              <Package size={24} className="text-emerald-600" /> Product Inventory
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-zinc-100 text-sm text-zinc-500">
                    <th className="py-3 font-bold">Image</th>
                    <th className="py-3 font-bold">Name</th>
                    <th className="py-3 font-bold">Category</th>
                    <th className="py-3 font-bold">Base Price</th>
                    <th className="py-3 font-bold">Pot Sizes</th>
                    <th className="py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-zinc-50 transition-colors hover:bg-zinc-50">
                      <td className="py-3">
                        <img
                          src={normalizeImageUrl(product.images[0]?.url ?? product.imageUrl)}
                          alt={product.name}
                          className="h-12 w-12 rounded object-cover"
                        />
                      </td>
                      <td className="py-3 font-bold text-zinc-800">{product.name}</td>
                      <td className="py-3 text-sm text-zinc-500">
                        <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-bold">{product.category.name}</span>
                      </td>
                      <td className="py-3 font-bold text-zinc-700">Rs {product.priceInr}</td>
                      <td className="py-3 text-xs text-zinc-600">
                        {product.potSize ? `${product.potSize} (Rs ${product.priceInr})` : "-"}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            className="rounded px-3 py-1 text-sm font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setModalConfig({
                                isOpen: true,
                                title: "Delete Product?",
                                message: "Are you sure you want to delete this product? This action cannot be undone.",
                                onConfirm: async () => {
                                  await deleteProduct(product.id);
                                },
                              })
                            }
                            className="rounded px-3 py-1 text-sm font-bold text-red-500 hover:bg-red-50 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400">
                        No products found. Add one above.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
      />
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
    <label className="block text-sm font-bold text-zinc-700">
      {props.label}
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-300 p-3"
      />
    </label>
  );
}
