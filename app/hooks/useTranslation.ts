import { useLanguageContext } from '~/context/LanguageContext'
import { t as translateFn } from '~/lib/translations'

export function useTranslation() {
  const { language } = useLanguageContext()
  
  return {
    t: (key: string) => translateFn(key, language),
    language,
  }
}
