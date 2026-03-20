// Shared time formatting utility
// compact: "5s", "3m", "1h"
// descriptive: "now", "5s ago", "3m ago"
export function formatTimeAgo(ts, { compact = false } = {}) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (!compact && diff < 5) return 'now'
  if (diff < 60) return compact ? `${diff}s` : `${diff}s ago`
  if (diff < 3600) return compact ? `${Math.floor(diff / 60)}m` : `${Math.floor(diff / 60)}m ago`
  return compact ? `${Math.floor(diff / 3600)}h` : `${Math.floor(diff / 3600)}h ago`
}
