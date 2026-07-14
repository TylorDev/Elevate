import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import en from '../i18n/en'

export const SUPPORTED_LANGUAGES = ['en']
export const DEFAULT_LANGUAGE = 'en'

const STORAGE_KEY = 'elevate.language'
const DICTIONARIES = { en }

const I18nContext = createContext(null)

function getDetectedLanguage() {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LANGUAGE
  }

  const languages = Array.isArray(navigator.languages) ? navigator.languages : []
  return languages[0] || navigator.language || DEFAULT_LANGUAGE
}

function resolveLanguage(language) {
  const normalizedLanguage = String(language || DEFAULT_LANGUAGE).toLowerCase()
  const baseLanguage = normalizedLanguage.split('-')[0]

  if (SUPPORTED_LANGUAGES.includes(normalizedLanguage)) {
    return normalizedLanguage
  }

  if (SUPPORTED_LANGUAGES.includes(baseLanguage)) {
    return baseLanguage
  }

  return DEFAULT_LANGUAGE
}

function getStoredLanguage() {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function persistLanguage(language) {
  try {
    window.localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Storage may be unavailable in hardened environments.
  }
}

function getByPath(source, key) {
  return String(key)
    .split('.')
    .reduce((currentValue, segment) => {
      if (currentValue && Object.prototype.hasOwnProperty.call(currentValue, segment)) {
        return currentValue[segment]
      }

      return undefined
    }, source)
}

function interpolate(template, params = {}) {
  if (typeof template !== 'string') {
    return template
  }

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    const value = params[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

function createInitialLanguage() {
  return resolveLanguage(getStoredLanguage() || getDetectedLanguage())
}

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(createInitialLanguage)

  useEffect(() => {
    persistLanguage(language)
  }, [language])

  const setLanguage = useCallback((nextLanguage) => {
    setLanguageState(resolveLanguage(nextLanguage))
  }, [])

  const t = useCallback(
    (key, params = {}, fallback = '') => {
      const dictionary = DICTIONARIES[language] || DICTIONARIES[DEFAULT_LANGUAGE]
      const defaultDictionary = DICTIONARIES[DEFAULT_LANGUAGE]
      const value = getByPath(dictionary, key) ?? getByPath(defaultDictionary, key)

      if (value === undefined) {
        return fallback || key
      }

      return interpolate(value, params)
    },
    [language]
  )

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      supportedLanguages: SUPPORTED_LANGUAGES,
      t
    }),
    [language, setLanguage, t]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }

  return context
}
