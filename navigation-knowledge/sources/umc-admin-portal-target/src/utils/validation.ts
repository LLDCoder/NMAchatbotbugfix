// Shared validation helpers for CMS forms.
// Single source of truth so the module "empty count" badges and the
// field-level antd rules agree on the same URL definition.
export const urlRegex =
  /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?(\?[^\s]*)?$/;

// International phone number: optional +, 6-15 digits.
export const phoneRegex = /^\+?\d{6,15}$/;
