"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Image as ImageIcon,
  Package,
  PlusCircle,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import Toast from "@/app/components/ui/Toast";
import ConfirmationModal from "@/app/components/ui/ConfirmationModal";
import {
  DEFAULT_CATEGORY_VALUES,
  POT_SIZE_CODE_VALUES,
  getPotSizeDisplayLabel,
  normalizeCategoryLabel,
  normalizeCustomPotSizeLabel,
  normalizePotSizeCode,
  type PotSizeCodeValue,
} from "@/lib/catalog";

type ProductImage = {
  id: string;
  url: string;
  sortOrder: number;
};

type ProductVariation = {
  id: string;
  sizeCode: PotSizeCodeValue;
  customSizeLabel: string | null;
  label: string;
  priceInr: number;
  stock: number;
  sortOrder: number;
};

type Product = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  images: ProductImage[];
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  variations: ProductVariation[];
  category: {
    name: string;
  };
};

type Order = {
  id: string;
  totalInr: number;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  shipmentStatus: "ORDER_RECEIVED" | "ITEM_PACKED" | "ITEM_SHIPPED";
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
    variationLabel: string;
    variation?: {
      label: string;
    } | null;
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

type VariationDraft = {
  sizeCode: PotSizeCodeValue;
  customSizeLabel: string;
  priceInr: number;
  stock: number;
};

type ProductPayload = {
  name: string;
  description: string;
  imageUrls: string[];
  categoryName: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  variations: VariationDraft[];
};

type TrackingDraft = {
  status: Order["status"];
  shipmentStatus: Order["shipmentStatus"];
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

const SIZE_OPTIONS: Array<{ value: PotSizeCodeValue; label: string }> = [
  { value: "S", label: "S (Small)" },
  { value: "M", label: "M (Medium)" },
  { value: "L", label: "L (Large)" },
  { value: "CUSTOM", label: "Custom" },
];

const emptyVariation: VariationDraft = {
  sizeCode: "M",
  customSizeLabel: "",
  priceInr: 0,
  stock: 0,
};

const emptyForm: ProductPayload = {
  name: "",
  description: "",
  imageUrls: [],
  categoryName: "Indoor",
  status: "ACTIVE",
  variations: [{ ...emptyVariation }],
};

function createTrackingDrafts(rows: Order[]) {
  return rows.reduce<Record<string, TrackingDraft>>((acc, row) => {
    acc[row.id] = {
      status: row.status,
      shipmentStatus: row.shipmentStatus,
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

const COUNTRY_DIAL_CODES: Record<string, string> = {
  india: "91",
  us: "1",
  usa: "1",
  "united states": "1",
  "united kingdom": "44",
  uk: "44",
  canada: "1",
  australia: "61",
  "united arab emirates": "971",
  uae: "971",
};

function resolveDialCode(country: string | null | undefined) {
  if (!country) {
    return "91";
  }

  const normalized = country.trim().toLowerCase();
  return COUNTRY_DIAL_CODES[normalized] ?? "91";
}

function normalizePhoneForWhatsApp(rawPhone: string, country: string | null | undefined) {
  const trimmed = rawPhone.trim();
  if (!trimmed) {
    return null;
  }

  let digits = "";

  if (trimmed.startsWith("+")) {
    digits = trimmed.replace(/\D/g, "");
  } else if (trimmed.startsWith("00")) {
    digits = trimmed.slice(2).replace(/\D/g, "");
  } else {
    digits = trimmed.replace(/\D/g, "");
  }

  if (!digits) {
    return null;
  }

  const dialCode = resolveDialCode(country);
  if (digits.length === 10) {
    return `${dialCode}${digits}`;
  }

  if (dialCode === "1" && digits.length === 11 && digits.startsWith("1")) {
    return digits;
  }

  if (dialCode === "91" && digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }

  if (digits.length < 8) {
    return null;
  }

  if (digits.length <= 12 && !digits.startsWith(dialCode)) {
    return `${dialCode}${digits}`;
  }

  return digits;
}

function buildShipmentWhatsAppMessage(order: Order, trackingId: string) {
  const customerName =
    (order.recipientName || order.profile?.fullName || order.profile?.email || "Customer").trim();

  const itemLines = order.items.length
    ? order.items
        .map((item) => {
          const variation = item.variationLabel || item.variation?.label;
          const suffix = variation ? ` - ${variation}` : "";
          return `   \u2022 ${item.product.name}${suffix} (x${item.quantity})`;
        })
        .join("\n")
    : "   \u2022 Item details unavailable";

  const leaf = "\u{1F33F}";
  const wave = "\u{1F44B}";
  const truck = "\u{1F69A}";
  const dash = "\u{1F4A8}";
  const box = "\u{1F4E6}";
  const moneyBag = "\u{1F4B0}";
  const home = "\u{1F3E1}";
  const greenHeart = "\u{1F49A}";
  const sunflower = "\u{1F33B}";
  const rupee = "\u20B9";

  return `${leaf} *GreenNest Order Update* ${leaf}

Hi *${customerName}*! ${wave}

Exciting news! Your order is packed with care and is now on its way to you. ${truck}${dash}

${box} *Order Details:*
${itemLines}

${moneyBag} *Total:* ${rupee}${order.totalInr}

${truck} *Tracking Info:*
   ID: ${trackingId || "Will be shared shortly"}

Thank you for bringing a piece of nature home! ${home}${greenHeart}

Happy Planting! ${sunflower}
*Team GreenNest*`;
}

function getStartingPrice(product: Product) {
  return Math.min(...product.variations.map((variation) => variation.priceInr));
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
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, TrackingDraft>>(() => createTrackingDrafts(initialOrders));
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>([]);

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
      categoryName: normalizeCategoryLabel(product.category.name),
      status: product.status,
      variations:
        product.variations.length > 0
          ? product.variations.map((variation) => ({
              sizeCode: normalizePotSizeCode(variation.sizeCode) ?? "CUSTOM",
              customSizeLabel: variation.customSizeLabel ?? "",
              priceInr: variation.priceInr,
              stock: variation.stock,
            }))
          : [{ ...emptyVariation }],
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

    const nextPreviewUrls = Array.from(files).map((file) => URL.createObjectURL(file));
    setLocalImagePreviews((prev) => [...prev, ...nextPreviewUrls]);
    void uploadFiles(files);
  };

  const removeImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const addVariation = () => {
    setForm((prev) => ({
      ...prev,
      variations: [...prev.variations, { ...emptyVariation, sizeCode: POT_SIZE_CODE_VALUES[0] }],
    }));
  };

  const updateVariation = (index: number, patch: Partial<VariationDraft>) => {
    setForm((prev) => ({
      ...prev,
      variations: prev.variations.map((variation, variationIndex) =>
        variationIndex === index ? { ...variation, ...patch } : variation,
      ),
    }));
  };

  const removeVariation = (index: number) => {
    setForm((prev) => ({
      ...prev,
      variations:
        prev.variations.length <= 1
          ? prev.variations
          : prev.variations.filter((_, variationIndex) => variationIndex !== index),
    }));
  };

  const normalizeVariationDrafts = (): { error: string } | { variations: VariationDraft[] } => {
    if (form.variations.length === 0) {
      return { error: "At least one variation is required." };
    }

    const seen = new Set<string>();
    const normalized: VariationDraft[] = [];

    for (let index = 0; index < form.variations.length; index += 1) {
      const variation = form.variations[index];
      const sizeCode = normalizePotSizeCode(variation.sizeCode);
      if (!sizeCode) {
        return { error: `Invalid size in variation #${index + 1}` };
      }

      const customSizeLabel =
        sizeCode === "CUSTOM" ? normalizeCustomPotSizeLabel(variation.customSizeLabel) : "";
      if (sizeCode === "CUSTOM" && !customSizeLabel) {
        return { error: `Custom size label is required in variation #${index + 1}` };
      }

      const priceInr = Number(variation.priceInr ?? 0);
      const stock = Number(variation.stock ?? 0);
      if (!Number.isInteger(priceInr) || priceInr <= 0) {
        return { error: `Invalid price in variation #${index + 1}` };
      }
      if (!Number.isInteger(stock) || stock < 0) {
        return { error: `Invalid stock in variation #${index + 1}` };
      }

      const label = getPotSizeDisplayLabel(sizeCode, customSizeLabel);
      const dedupeKey = label.toLowerCase();
      if (seen.has(dedupeKey)) {
        return { error: `Duplicate variation "${label}"` };
      }
      seen.add(dedupeKey);

      normalized.push({
        sizeCode,
        customSizeLabel: customSizeLabel || "",
        priceInr,
        stock,
      });
    }

    return { variations: normalized };
  };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedCategory = normalizeCategoryLabel(form.categoryName);
    if (!form.name.trim() || !normalizedCategory) {
      pushToast("error", "Please fill all required fields.");
      return;
    }

    if (form.imageUrls.length === 0) {
      pushToast("error", "Upload at least one product image.");
      return;
    }

    const parsedVariations = normalizeVariationDrafts();
    if ("error" in parsedVariations) {
      pushToast("error", parsedVariations.error);
      return;
    }

    setSaving(true);

    const url = editingId ? `/api/admin/products/${editingId}` : "/api/admin/products";
    const method = editingId ? "PATCH" : "POST";

    const payload: ProductPayload = {
      ...form,
      categoryName: normalizedCategory,
      variations: parsedVariations.variations,
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

  const saveOrderTracking = async (orderId: string, draftOverride?: TrackingDraft) => {
    const draft = draftOverride ?? trackingDrafts[orderId];
    if (!draft) {
      return null;
    }

    setSavingOrderId(orderId);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        pushToast("error", data.error ?? "Tracking update failed");
        return null;
      }

      const data = (await res.json()) as { order: Order };

      setOrders((prev) => prev.map((row) => (row.id === orderId ? data.order : row)));
      setTrackingDrafts((prev) => ({
        ...prev,
        [orderId]: {
          status: data.order.status,
          shipmentStatus: data.order.shipmentStatus,
          shippingProvider: data.order.shippingProvider ?? "",
          shippingTrackingId: data.order.shippingTrackingId ?? "",
          shippingInstructions: data.order.shippingInstructions ?? "",
          shippingUrl: data.order.shippingUrl ?? "",
          markShipped: Boolean(data.order.shippedAt),
        },
      }));
      pushToast("success", "Order updated.");
      return data.order;
    } catch {
      pushToast("error", "Tracking update failed");
      return null;
    } finally {
      setSavingOrderId((prev) => (prev === orderId ? null : prev));
    }
  };

  const persistTrackingPatch = async (orderId: string, patch: Partial<TrackingDraft>) => {
    const current = trackingDrafts[orderId];
    if (!current) {
      return;
    }

    const nextDraft: TrackingDraft = {
      ...current,
      ...patch,
    };

    setTrackingDrafts((prev) => ({
      ...prev,
      [orderId]: nextDraft,
    }));

    const updatedOrder = await saveOrderTracking(orderId, nextDraft);

    if (!updatedOrder) {
      return;
    }

    const shouldOpenWhatsApp =
      patch.shipmentStatus === "ITEM_SHIPPED" && current.shipmentStatus !== "ITEM_SHIPPED";
    if (!shouldOpenWhatsApp) {
      return;
    }

    const normalizedPhone = normalizePhoneForWhatsApp(updatedOrder.recipientPhone, updatedOrder.country);
    if (!normalizedPhone) {
      pushToast("error", "Could not open WhatsApp: invalid phone number.");
      return;
    }

    const trackingId = nextDraft.shippingTrackingId || updatedOrder.shippingTrackingId || "";
    const message = buildShipmentWhatsAppMessage(updatedOrder, trackingId);
    const params = new URLSearchParams({
      phone: normalizedPhone,
      text: message,
    });
    const waUrl = `https://web.whatsapp.com/send?${params.toString()}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
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
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-4xl font-bold text-emerald-900">Admin Dashboard</h1>
            <Link
              href="/admin/audit"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              View Audit Logs
            </Link>
          </div>

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

                <div className="rounded-xl border border-zinc-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-zinc-700">Variations</h3>
                    <button
                      type="button"
                      onClick={addVariation}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                    >
                      <PlusCircle size={14} />
                      Add variation
                    </button>
                  </div>

                  <div className="space-y-3">
                    {form.variations.map((variation, index) => (
                      <div key={index} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                          <label className="text-xs font-semibold text-zinc-600">
                            Size
                            <select
                              value={variation.sizeCode}
                              onChange={(event) =>
                                updateVariation(index, {
                                  sizeCode: (normalizePotSizeCode(event.target.value) ?? "M") as PotSizeCodeValue,
                                  customSizeLabel: event.target.value === "CUSTOM" ? variation.customSizeLabel : "",
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                            >
                              {SIZE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          {variation.sizeCode === "CUSTOM" ? (
                            <label className="text-xs font-semibold text-zinc-600">
                              Custom Size Label
                              <input
                                value={variation.customSizeLabel}
                                onChange={(event) => updateVariation(index, { customSizeLabel: event.target.value })}
                                className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                                placeholder="e.g. 12 inch"
                              />
                            </label>
                          ) : (
                            <div />
                          )}

                          <label className="text-xs font-semibold text-zinc-600">
                            Price (Rs)
                            <input
                              type="number"
                              value={String(variation.priceInr || "")}
                              onChange={(event) => updateVariation(index, { priceInr: Number(event.target.value || 0) })}
                              className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                            />
                          </label>

                          <label className="text-xs font-semibold text-zinc-600">
                            Stock
                            <input
                              type="number"
                              value={String(variation.stock || "")}
                              onChange={(event) => updateVariation(index, { stock: Number(event.target.value || 0) })}
                              className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                            />
                          </label>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-xs text-zinc-500">
                            Label:{" "}
                            {getPotSizeDisplayLabel(
                              variation.sizeCode,
                              variation.sizeCode === "CUSTOM" ? variation.customSizeLabel : "",
                            )}
                          </p>
                          <button
                            type="button"
                            disabled={form.variations.length <= 1}
                            onClick={() => removeVariation(index)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                          >
                            <Trash2 size={13} />
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
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
                        <div className="flex flex-col gap-2">
                          <select
                            value={draft?.status ?? order.status}
                            onChange={(event) =>
                              void persistTrackingPatch(order.id, {
                                status: event.target.value as Order["status"],
                              })
                            }
                            disabled={savingOrderId === order.id}
                            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-bold"
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="PAID">PAID</option>
                            <option value="FAILED">FAILED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                          <select
                            value={draft?.shipmentStatus ?? order.shipmentStatus}
                            onChange={(event) =>
                              void persistTrackingPatch(order.id, {
                                shipmentStatus: event.target.value as Order["shipmentStatus"],
                              })
                            }
                            disabled={savingOrderId === order.id}
                            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-bold"
                          >
                            <option value="ORDER_RECEIVED">Order Received</option>
                            <option value="ITEM_PACKED">Item Packed</option>
                            <option value="ITEM_SHIPPED">Item Shipped</option>
                          </select>
                        </div>
                      </div>

                      <div className="mb-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
                        {order.addressLine1}
                        {order.addressLine2 ? `, ${order.addressLine2}` : ""}, {order.city}, {order.state} {order.postalCode}
                      </div>

                      <div className="mb-4 space-y-1">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex justify-between border-b border-dashed border-zinc-100 py-1 text-sm">
                            <span className="font-medium text-zinc-700">
                              {item.product.name} ({item.variationLabel || item.variation?.label || "Standard"}){" "}
                              <span className="font-normal text-zinc-400">x{item.quantity}</span>
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
                            onClick={() => void saveOrderTracking(order.id)}
                            disabled={savingOrderId === order.id}
                            className="rounded bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                          >
                            {savingOrderId === order.id ? "Saving..." : "Save"}
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
                    <th className="py-3 font-bold">Starting Price</th>
                    <th className="py-3 font-bold">Variations</th>
                    <th className="py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-zinc-50 align-top transition-colors hover:bg-zinc-50">
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
                      <td className="py-3 font-bold text-zinc-700">Rs {getStartingPrice(product)}</td>
                      <td className="py-3 text-xs text-zinc-600">
                        <div className="space-y-1">
                          {product.variations.map((variation) => (
                            <p key={variation.id}>
                              {variation.label}: Rs {variation.priceInr} (Stock {variation.stock})
                            </p>
                          ))}
                        </div>
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
