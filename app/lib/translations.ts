import type { Language } from './constants'

// Import all translation files
import enCommon from '~/locales/en/common.json'
import mrCommon from '~/locales/mr/common.json'
import hiCommon from '~/locales/hi/common.json'

const translations: Record<Language, typeof enCommon> = {
  en: enCommon,
  mr: mrCommon as unknown as typeof enCommon,
  hi: hiCommon as unknown as typeof enCommon,
}

/**
 * Translate a key using dot notation.
 * Usage: t('common.ok', 'en') → "OK"
 *        t('auth.login_page.heading', 'en') → "DisasterShield"
 */
export function t(key: string, language: Language = 'en'): string {
  const keys = key.split('.')
  let current: any = translations[language]

  for (const k of keys) {
    current = current?.[k]
    if (current === undefined) {
      console.warn(`Translation key not found: ${key} for language: ${language}`)
      return key // Fallback to key itself
    }
  }

  return typeof current === 'string' ? current : key
}

export default translations
