export const DEFAULT_CATEGORY_VALUES = ["Indoor", "Outdoor"] as const;
export const DEFAULT_POT_SIZE_VALUES = ["Small", "Medium", "Large"] as const;

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
