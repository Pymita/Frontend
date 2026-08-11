import { computed, type ComputedRef } from 'vue'
import { useAuthStore } from '../stores/auth'

/**
 * Read-only mode: the company's subscription is suspended.
 *
 * Actions that write are shown greyed out instead of hidden — the customer
 * has to see what they lost to have a reason to renew. Greying out is not
 * the control: the backend rejects the write with a 402 either way
 * (see EnsureSubscriptionActive).
 */
export function useReadOnly(): ComputedRef<boolean> {
  const authStore = useAuthStore()

  return computed(() => authStore.isReadOnly)
}
