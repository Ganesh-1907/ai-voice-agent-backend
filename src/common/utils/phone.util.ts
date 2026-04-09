export function normalizePhoneNumber(phoneNumber: string | null | undefined) {
  if (!phoneNumber) {
    return "";
  }

  return phoneNumber.replace(/[^\d+]/g, "");
}
