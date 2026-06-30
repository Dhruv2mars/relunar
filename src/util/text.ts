export function excerpt(text: string, maxLength = 4000): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return trimmed.slice(trimmed.length - maxLength);
}
