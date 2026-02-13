type ClerkErrorLike = {
  message?: unknown;
  code?: unknown;
  errors?: Array<{
    message?: unknown;
    longMessage?: unknown;
    code?: unknown;
  }>;
};

function toCleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed === "isUnknown" || trimmed === "[object Object]") {
    return null;
  }

  return trimmed;
}

function friendlyMessageFromCode(code: string | null): string | null {
  if (!code) {
    return null;
  }

  const normalized = code.trim().toLowerCase();

  if (normalized === "form_identifier_exists") {
    return "An account with this email already exists.";
  }

  if (normalized === "form_password_pwned") {
    return "This password is not secure. Please choose a different one.";
  }

  return null;
}

export function getClerkErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return toCleanString(error) ?? fallback;
  }

  if (error instanceof Error) {
    const direct = toCleanString(error.message);
    if (direct) {
      return direct;
    }
  }

  if (typeof error === "object" && error !== null) {
    const data = error as ClerkErrorLike;
    const first = data.errors?.[0];

    const longMessage = toCleanString(first?.longMessage);
    if (longMessage) {
      return longMessage;
    }

    const message = toCleanString(first?.message) ?? toCleanString(data.message);
    if (message) {
      return message;
    }

    const byCode = friendlyMessageFromCode(
      toCleanString(first?.code) ?? toCleanString(data.code),
    );
    if (byCode) {
      return byCode;
    }
  }

  return fallback;
}
