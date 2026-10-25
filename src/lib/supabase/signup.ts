export function parseSignUpInput(data: FormData): { email: string; password: string } | null {
  const email =
    typeof data.get('email') === 'string' ? String(data.get('email')).trim().toLowerCase() : '';
  const password = data.get('password');
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== 'string' ||
    password.length < 12 ||
    password.length > 128 ||
    password !== data.get('confirmation')
  )
    return null;
  return { email, password };
}

/** Server Actions validate Origin against Host; reject malformed origins as well. */
export function signUpCallbackUrl(origin: string | null): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    if (
      url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    )
      return null;
    return `${url.origin}/auth/callback`;
  } catch {
    return null;
  }
}
