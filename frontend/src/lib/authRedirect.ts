const PRODUCTION_FALLBACK_ORIGIN = 'https://www.thevaultsentry.com'

function isLocalOrigin(origin: string) {
  const parsed = new URL(origin)
  return (
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '[::1]'
  )
}

function normalizeAppOrigin(origin: string) {
  const parsed = new URL(origin)
  const isLocal = isLocalOrigin(origin)

  if (isLocal && process.env.NODE_ENV !== 'production') {
    parsed.protocol = 'http:'
  } else if (!isLocal) {
    parsed.protocol = 'https:'
  }

  return parsed.origin
}

export function getAuthRedirectUrl(path = '/auth/callback') {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const isProduction = process.env.NODE_ENV === 'production'

  if (configuredUrl && !(isProduction && isLocalOrigin(configuredUrl))) {
    return `${normalizeAppOrigin(configuredUrl)}${normalizedPath}`
  }

  if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin

    if (!(isProduction && isLocalOrigin(currentOrigin))) {
      return `${normalizeAppOrigin(currentOrigin)}${normalizedPath}`
    }
  }

  if (isProduction) {
    return `${PRODUCTION_FALLBACK_ORIGIN}${normalizedPath}`
  }

  return normalizedPath
}
