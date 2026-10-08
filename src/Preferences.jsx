import React, {createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useState} from 'react';
import {languages, translate} from './translations';

const PreferencesContext = createContext(null);
const storageKey = 'pasion-preferences';
const languageCodes = new Set(languages.map(language => language.code));

function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return {language: languageCodes.has(saved?.language) ? saved.language : 'en', theme: saved?.theme === 'dark' ? 'dark' : 'light'};
  } catch {
    return {language: 'en', theme: 'light'};
  }
}

export function PreferencesProvider({children}) {
  const [preferences, setPreferences] = useState(readPreferences);
  const {language, theme} = preferences;
  const setLanguage = useCallback(value => {
    if (languageCodes.has(value)) setPreferences(previous => ({...previous, language: value}));
  }, []);
  const setTheme = useCallback(value => {
    if (value === 'light' || value === 'dark') setPreferences(previous => ({...previous, theme: value}));
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = language === 'ar' ? 'rtl' : 'ltr';
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }, [language, theme]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { /* Preferences still work when storage is unavailable. */ }
  }, [preferences]);

  useEffect(() => {
    function sync(event) {
      if (event.key === storageKey || event.key === null) setPreferences(readPreferences());
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const t = useCallback((text, values) => translate(language, text, values), [language]);
  const value = useMemo(() => ({language, setLanguage, theme, setTheme, t}), [language, setLanguage, theme, setTheme, t]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside PreferencesProvider.');
  return context;
}

function PreferenceIcon({name}) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'language' ? <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18"/></> : name === 'dark' ? <path d="M20.5 14a8.5 8.5 0 0 1-10.5-10.5A8.5 8.5 0 1 0 20.5 14Z"/> : <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>}</svg>;
}

export function PreferenceControls({compact = false}) {
  const {language, setLanguage, theme, setTheme, t} = usePreferences();
  const selectId = useId();
  return <div className={'preference-controls' + (compact ? ' is-compact' : '')}>
    <div className="preference-language">
      <label htmlFor={selectId}><PreferenceIcon name="language"/><span className={compact ? 'sr-only' : 'preference-label'}>{t('Language')}</span></label>
      <select id={selectId} value={language} onChange={event => setLanguage(event.target.value)} aria-label={t('Language')}>
        {languages.map(item => <option key={item.code} value={item.code} lang={item.code}>{item.nativeName}</option>)}
      </select>
    </div>
    {compact ? <button type="button" className="theme-toggle" aria-label={t(theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode')} title={t(theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode')} aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><PreferenceIcon name={theme === 'light' ? 'dark' : 'light'}/></button> : <div className="preference-theme"><span className="preference-label">{t('Appearance')}</span><div className="preference-options" role="group" aria-label={t('Appearance')}>{['light', 'dark'].map(mode => <button key={mode} type="button" className={'preference-option' + (theme === mode ? ' is-selected' : '')} aria-pressed={theme === mode} onClick={() => setTheme(mode)}><PreferenceIcon name={mode}/>{t(mode === 'light' ? 'Light mode' : 'Dark mode')}</button>)}</div><p>{t('Your preferences are saved on this browser.')}</p></div>}
  </div>;
}
