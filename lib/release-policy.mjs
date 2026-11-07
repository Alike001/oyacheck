// This release supports local operator pilots only. No environment flag can
// activate a financial path in production or on Render's ephemeral filesystem.
export function financialActionsBlocked(env = process.env) {
  return env.NODE_ENV === 'production' || env.RENDER === 'true' || env.OYACHECK_READ_ONLY === '1';
}
