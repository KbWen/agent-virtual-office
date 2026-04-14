// Shared time formatting utility
// compact: "5s", "3m", "1h"
// descriptive: "now", "5s ago", "3m ago"
import { t } from '../i18n'

export function formatTimeAgo(ts, { compact = false } = {}) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (!compact && diff < 5) return t('time.now', 'now')
  if (diff < 60) return compact ? `${diff}s` : t('time.secondsAgo', '{0}s ago').replace('{0}', diff)
  if (diff < 3600) return compact ? `${Math.floor(diff / 60)}m` : t('time.minutesAgo', '{0}m ago').replace('{0}', Math.floor(diff / 60))
  return compact ? `${Math.floor(diff / 3600)}h` : t('time.hoursAgo', '{0}h ago').replace('{0}', Math.floor(diff / 3600))
}
