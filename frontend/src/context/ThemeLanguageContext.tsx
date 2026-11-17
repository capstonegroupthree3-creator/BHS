import React, { createContext, useContext, useState, useEffect } from 'react';
import i18n from '../i18n';

type Theme = 'light' | 'dark';
type Language = 'en' | 'ceb';

interface ThemeLanguageContextType {
  theme: Theme;
  lang: Language;
  toggleTheme: () => void;
  toggleLang: () => void;
  t: (enText: string, filText?: string) => string;
}

const ThemeLanguageContext = createContext<ThemeLanguageContextType | undefined>(undefined);

export const ThemeLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('sbhms_theme') as Theme) || 'light');
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('sbhms_language') as Language) || 'en');

  useEffect(() => {
    localStorage.setItem('sbhms_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  const toggleLang = () => {
    const newLang: Language = lang === 'en' ? 'ceb' : 'en';
    setLang(newLang);
    localStorage.setItem('sbhms_language', newLang);
    i18n.changeLanguage(newLang);
  };

  // Cebuano nav/UI translations for the custom t() used by Layout
  const cebTranslations: Record<string, string> = {
    'Dashboard': 'Dashboard',
    'Health Programs': 'Mga Programa sa Kahimsog',
    'Children': 'Mga Bata',
    'Senior Citizens': 'Mga Senior Citizen',
    'Pregnant Women': 'Mga Mabdos nga Babaye',
    'Vaccinations': 'Pagbakuna',
    'Districts & Sitios': 'Mga Distrito ug Sityo',
    'User Accounts': 'Mga User Account',
    'Health Personnel': 'Mga Kawani sa Kahimsog',
    'Parents / Guardians': 'Mga Ginikanan ug Tagdumala',
    'AI Priority List': 'AI Priority List',
    'Nutrition Analysis': 'Pagsusi sa Nutrisyon',
    'Consent Management': 'Pamamahala sa Pahintulot',
    'Family Health': 'Kahimsog sa Pamilya',
    'Disease Trends': 'Mga Trend sa Sakit',
    'Analytics': 'Analytics',
    'Reports': 'Mga Taho',
    'Audit Logs': 'Audit Trail',
    'AI Settings': 'Mga Setting',
    'Logout': 'Mogawas',
    'Smart Barangay Health System': 'Smart Barangay Health System',
  };

  const t = (enText: string, _filText?: string): string => {
    if (lang === 'ceb') {
      return cebTranslations[enText] ?? enText;
    }
    return enText;
  };

  return (
    <ThemeLanguageContext.Provider value={{ theme, lang, toggleTheme, toggleLang, t }}>
      {children}
    </ThemeLanguageContext.Provider>
  );
};

export const useThemeLanguage = () => {
  const context = useContext(ThemeLanguageContext);
  if (!context) {
    throw new Error('useThemeLanguage must be used within ThemeLanguageProvider');
  }
  return context;
};
