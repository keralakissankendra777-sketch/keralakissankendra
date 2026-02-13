export const DEFAULT_CATEGORY_VALUES = ["Indoor", "Outdoor"] as const;
export const POT_SIZE_CODE_VALUES = ["S", "M", "L", "CUSTOM"] as const;

export type PotSizeCodeValue = (typeof POT_SIZE_CODE_VALUES)[number];

const POT_SIZE_LABELS: Record<PotSizeCodeValue, string> = {
  S: "Small",
  M: "Medium",
  L: "Large",
  CUSTOM: "Custom",
};

export function normalizeCategoryLabel(value: string | undefined | null) {
  if (!value) {
    return "";
  }

  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return "";
  }

  return cleaned
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizePotSizeLabel(value: string | undefined | null) {
  if (!value) {
    return "";
  }

  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return "";
  }

  return cleaned
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizePotSizeCode(value: string | undefined | null): PotSizeCodeValue | null {
  if (!value) {
    return null;
  }

  const cleaned = value.trim().toUpperCase();
  const aliasMap: Record<string, PotSizeCodeValue> = {
    SMALL: "S",
    MEDIUM: "M",
    LARGE: "L",
  };

  if (cleaned in aliasMap) {
    return aliasMap[cleaned];
  }

  if (POT_SIZE_CODE_VALUES.includes(cleaned as PotSizeCodeValue)) {
    return cleaned as PotSizeCodeValue;
  }

  return null;
}

export function normalizeCustomPotSizeLabel(value: string | undefined | null) {
  return normalizePotSizeLabel(value);
}

export function getPotSizeDisplayLabel(
  sizeCode: PotSizeCodeValue,
  customSizeLabel?: string | null,
) {
  if (sizeCode === "CUSTOM") {
    return normalizeCustomPotSizeLabel(customSizeLabel) || "Custom";
  }

  return POT_SIZE_LABELS[sizeCode];
}
