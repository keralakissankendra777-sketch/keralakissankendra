import { PotSizeCode } from "@prisma/client";
import {
  getPotSizeDisplayLabel,
  normalizeCustomPotSizeLabel,
  normalizePotSizeCode,
} from "@/lib/catalog";
import { cleanText } from "@/lib/security";

type VariationLike = {
  sizeCode?: unknown;
  customSizeLabel?: unknown;
  priceInr?: unknown;
  stock?: unknown;
};

export type NormalizedVariation = {
  sizeCode: PotSizeCode;
  customSizeLabel: string | null;
  label: string;
  priceInr: number;
  stock: number;
  sortOrder: number;
};

export function parseVariationPayload(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) {
    return { error: "At least one valid variation is required" } as const;
  }

  const seenLabels = new Set<string>();
  const variations: NormalizedVariation[] = [];

  for (let index = 0; index < raw.length; index += 1) {
    const row = raw[index] as VariationLike;
    const sizeCode = normalizePotSizeCode(
      typeof row?.sizeCode === "string" ? row.sizeCode : "",
    );

    if (!sizeCode) {
      return { error: `Invalid size in variation #${index + 1}` } as const;
    }

    const customInput = cleanText(
      typeof row?.customSizeLabel === "string" ? row.customSizeLabel : "",
      40,
    );
    const customSizeLabel =
      sizeCode === "CUSTOM" ? normalizeCustomPotSizeLabel(customInput) : "";

    if (sizeCode === "CUSTOM" && !customSizeLabel) {
      return { error: `Custom size label is required in variation #${index + 1}` } as const;
    }

    const label = getPotSizeDisplayLabel(sizeCode, customSizeLabel);
    const labelKey = label.toLowerCase();
    if (seenLabels.has(labelKey)) {
      return { error: `Duplicate variation "${label}"` } as const;
    }
    seenLabels.add(labelKey);

    const priceInr = Number(row?.priceInr ?? 0);
    const stock = Number(row?.stock ?? 0);

    if (!Number.isInteger(priceInr) || priceInr <= 0) {
      return { error: `Invalid price in variation "${label}"` } as const;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      return { error: `Invalid stock in variation "${label}"` } as const;
    }

    variations.push({
      sizeCode,
      customSizeLabel: customSizeLabel || null,
      label,
      priceInr,
      stock,
      sortOrder: index,
    });
  }

  return { variations } as const;
}

export function getDerivedProductFields(variations: NormalizedVariation[]) {
  const minPriceInr = Math.min(...variations.map((variation) => variation.priceInr));
  const totalStock = variations.reduce((sum, variation) => sum + variation.stock, 0);
  const defaultPotSize = variations[0]?.label ?? "Medium";

  return {
    minPriceInr,
    totalStock,
    defaultPotSize,
  };
}
