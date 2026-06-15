import { RemixI18Next } from 'remix-i18next/server'
import { resolve } from 'node:path'

let instance: RemixI18Next

export function i18n() {
  if (instance) return instance

  instance = new RemixI18Next({
    detection: {
      order: ['cookie', 'header'],
      supportedLanguages: ['en', 'mr', 'hi'],
      fallbackLanguage: 'en',
    },
    i18next: {
      supportedLngs: ['en', 'mr', 'hi'],
      fallbackLng: 'en',
      ns: 'common',
      defaultNS: 'common',
      backend: {
        loadPath: resolve('./app/locales/{{lng}}/{{ns}}.json'),
      },
    },
  })

  return instance
}
