/** Proxied URL for LINE profile images (see `/api/liff/profile-image`). */
export function liffProfileImageSrc(pictureUrl: string | null | undefined): string | null {
  if (!pictureUrl?.trim()) return null;
  return `/api/liff/profile-image?url=${encodeURIComponent(pictureUrl.trim())}`;
}
