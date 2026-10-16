import {
  AsYouType,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";

const fullNameCharacters = /^[\p{L}\p{M}\p{Zs}'’\p{Pd}]+$/u;
const phoneCharacters = /^[+\d\p{Zs}()\-]+$/u;

export function validFullName(value: string): boolean {
  if (value.length > 100) return false;
  const trimmed = value.trim();
  return fullNameCharacters.test(trimmed) && (trimmed.match(/\p{L}/gu)?.length ?? 0) >= 2;
}

export function filterNameInput(value: string): string {
  return value.replace(/[^\p{L}\p{M}\p{Zs}'’\p{Pd}]/gu, "");
}

export function filterPhoneInput(value: string): string {
  return value.replace(/[^\d+()\s-]/g, "").replace(/(?!^)\+/g, "");
}

export function hasOnlyPhoneCharacters(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed || phoneCharacters.test(trimmed);
}

export function validRegistrationPhone(value: string): boolean {
  if (value.length > 25) return false;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!phoneCharacters.test(trimmed)) return false;
  const normalized = trimmed.replace(/^00/, "+");
  const phone = parsePhoneNumberFromString(normalized, { defaultCountry: "CR", extract: false });
  if (phone?.isValid()) return true;
  if (!normalized.startsWith("+")) {
    const withPlus = parsePhoneNumberFromString("+" + normalized, { extract: false });
    if (withPlus?.isValid()) return true;
  }
  return false;
}

export function detectedPhoneRegion(value: string): { country: CountryCode; callingCode: string } | null {
  const trimmed = value.trim();
  if (!trimmed || !phoneCharacters.test(trimmed) || !/\d/.test(trimmed)) return null;

  let normalized = trimmed.replace(/^00/, "+");
  const rawDigits = trimmed.replace(/\D/g, "");

  if (!normalized.startsWith("+")) {
    if (rawDigits.startsWith("1") || rawDigits.startsWith("506")) {
      normalized = "+" + normalized;
    } else if (rawDigits.length === 8 && /^[2-8]/.test(rawDigits)) {
      return { country: "CR", callingCode: "506" };
    } else {
      const parsedWithPlus = parsePhoneNumberFromString("+" + normalized);
      if (parsedWithPlus?.isValid()) {
        normalized = "+" + normalized;
      }
    }
  }

  if (!normalized.startsWith("+")) {
    return { country: "CR", callingCode: getCountryCallingCode("CR") };
  }

  const formatter = new AsYouType();
  formatter.input(normalized);
  const callingCode = formatter.getCallingCode();
  if (!callingCode) return null;

  let country = formatter.getCountry();
  if (!country) {
    const parsed = parsePhoneNumberFromString(normalized);
    if (parsed && parsed.country) country = parsed.country;
  }
  if (!country && callingCode) {
    const primary = (formatter as unknown as { metadata?: { metadata?: { country_calling_codes?: Record<string, CountryCode[]> } } })
      .metadata?.metadata?.country_calling_codes?.[callingCode]?.[0];
    if (primary) country = primary;
  }
  return country ? { country, callingCode: getCountryCallingCode(country) || callingCode } : null;
}

