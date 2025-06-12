type Warnings = "dismissAlphaWarning";

export const isDismissWarning = (key: Warnings) => {
  return localStorage.getItem(key) == "true";
};

export const onDismiss = (key: Warnings) => {
  localStorage.setItem(key, "true");
};
