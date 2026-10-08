export type Language = "es" | "en";
export const languageOf = (value: unknown): Language => value === "en" ? "en" : "es";
