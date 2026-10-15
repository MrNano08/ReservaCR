import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export function validBusinessPhone(value: string): boolean {
  if (value.length > 25 || !/^(?:\+506[ -]?)?\d{4}[ -]?\d{4}$/.test(value.trim())) return false;
  const phone = parsePhoneNumberFromString(value.trim(), "CR");
  return phone?.country === "CR" && phone.isValid();
}
