import i18n from "./config";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
export function validationMessage(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const validity = input.validity;
  if (validity.valueMissing) return i18n.t("validation:required");
  if (validity.typeMismatch && input.type === "email") return i18n.t("validation:invalidEmail");
  if (validity.tooShort && "minLength" in input) return i18n.t("validation:minLength", { min: input.minLength });
  if (validity.tooLong && "maxLength" in input) return i18n.t("validation:maxLength", { max: input.maxLength });
  if (validity.patternMismatch && input.type === "password") return i18n.t("validation:passwordRequirements");
  return i18n.t("validation:invalid");
}
export function useLocalizedValidation() {
  const { i18n: instance } = useTranslation();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select").forEach(input => {
      if (input.validity.customError) {
        input.setCustomValidity("");
        if (!input.validity.valid) input.setCustomValidity(validationMessage(input));
      }
    });
  }, [instance.language]);
  return {
    ref,
    onInvalidCapture: (event: React.FormEvent<HTMLFormElement>) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
        event.target.setCustomValidity("");
        event.target.setCustomValidity(validationMessage(event.target));
      }
    },
    onInputCapture: (event: React.FormEvent<HTMLFormElement>) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) event.target.setCustomValidity("");
    },
  };
}
