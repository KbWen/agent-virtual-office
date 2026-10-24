import { useSyncExternalStore } from 'react'
import { getCozyInteractionsEnabled, subscribeCozyInteractions } from '../systems/cozyPreferences.js'

const serverSnapshot = () => false
export function useCozyInteractions() {
  return useSyncExternalStore(subscribeCozyInteractions, getCozyInteractionsEnabled, serverSnapshot)
}
