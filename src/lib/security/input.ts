export function sanitizeText(input: unknown, maxLen = 255): string {
  if (typeof input !== "string") return "";
  return input.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLen);
}

export function sanitizePhone(input: unknown): string {
  const raw = sanitizeText(input, 30);
  return raw.replace(/[^\d+()-\s]/g, "");
}
