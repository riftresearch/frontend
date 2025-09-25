/**
 * Utility to check if we're on the admin page and should disable wallet functionality
 */
export const isAdminPage = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.location.pathname === "/admin";
};

/**
 * Guard function to prevent wallet operations on admin page
 */
export const guardWalletOperation = (operation: () => void | Promise<void>) => {
  if (isAdminPage()) {
    console.warn("Wallet operation blocked on admin page");
    return;
  }
  return operation();
};
