function normalizeAppOrigin(origin: string) {
  const parsed = new URL(origin)
  const isLocal =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '[::1]'

  if (!isLocal) {
    parsed.protocol = 'https:'
  }

  return parsed.origin
}

export function getAuthRedirectUrl(path = '/auth/callback') {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  const productionFallbackUrl =
    process.env.NODE_ENV === 'production' ? 'https://www.thevaultsentry.com' : ''
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (configuredUrl || productionFallbackUrl) {
    return `${normalizeAppOrigin(configuredUrl || productionFallbackUrl)}${normalizedPath}`
  }

  if (typeof window !== 'undefined') {
    return `${normalizeAppOrigin(window.location.origin)}${normalizedPath}`
  }

  return normalizedPath
}
