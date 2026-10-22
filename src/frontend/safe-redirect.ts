/** Where to go after signing in: only a path on this site ("/…", not "//…" or another host). */
export const safeRedirect = (value: unknown): string => {
  const v = typeof value === 'string' ? value.trim() : ''
  return v.startsWith('/') && !v.startsWith('//') && !v.includes('\\') && !/[\u0000-\u001f]/.test(v) ? v : '/'
}
