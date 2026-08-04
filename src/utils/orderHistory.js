export const ORDER_HISTORY_STORAGE_KEY = "minhag_kosher_order_history_v1";
const MAX_ORDERS = 30;

const canUseStorage = () => {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
};

export function getOrderHistory() {
  if (!canUseStorage()) return [];
  try {
    const stored = window.localStorage.getItem(ORDER_HISTORY_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const createOrderId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `order-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export function saveOrderToHistory(order) {
  const newOrder = {
    ...order,
    id: createOrderId(),
    createdAt: new Date().toISOString(),
    status: "sent_to_whatsapp",
  };

  try {
    const updated = [newOrder, ...getOrderHistory()].slice(0, MAX_ORDERS);
    window.localStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return newOrder;
  } catch {
    return null;
  }
}

export function deleteOrderFromHistory(orderId) {
  if (!canUseStorage()) return [];
  const updated = getOrderHistory().filter((order) => order.id !== orderId);
  try {
    window.localStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    return getOrderHistory();
  }
  return updated;
}

export function clearOrderHistory() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(ORDER_HISTORY_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private or restricted browsing modes.
  }
}
