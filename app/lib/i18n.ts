export const supportedLanguages = ['en', 'mr', 'hi'] as const
export type Language = typeof supportedLanguages[number]

export const languageNames: Record<Language, string> = {
  en: 'English',
  mr: 'मराठी',
  hi: 'हिंदी',
}
