import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';
type Language = 'en' | 'fil';

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
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('sbhms_lang') as Language) || 'en');

  useEffect(() => {
    localStorage.setItem('sbhms_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sbhms_lang', lang);
  }, [lang]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  const toggleLang = () => setLang((prev) => (prev === 'en' ? 'fil' : 'en'));

  const translations: Record<string, string> = {
    'Dashboard': 'Talaan ng Kalusugan',
    'Health Programs': 'Mga Programa sa Kalusugan',
    'Children': 'Mga Bata (Pediatric)',
    'Senior Citizens': 'Mga Nakatatanda (Seniors)',
    'Pregnant Women': 'Mga Buntis at Ina',
    'Vaccinations': 'Mga Bakuna at Imyunisasyon',
    'Districts & Sitios': 'Mga Purok at Sitio',
    'User Accounts': 'Mga Account ng User',
    'Health Personnel': 'Mga Manggagawang Pangkasulugan',
    'Parents / Guardians': 'Mga Magulang at Tagapangalaga',
    'AI Priority List': 'Listahan ng Utos ng AI',
    'Disease Trends': 'Ulat ng mga Sakit',
    'Analytics': 'Mapanuring Ulat (Analytics)',
    'Reports': 'Mga Opisyal na Ulat',
    'Audit Logs': 'Talaan ng Aksyon (Audit)',
    'AI Settings': 'Mga Setting ng AI',
    'Logout': 'Mag-logout',
    'Register Child': 'Magrehistro ng Bata',
    'Register Parent / Guardian': 'Magrehistro ng Magulang',
    'Register Senior Citizen': 'Magrehistro ng Senior Citizen',
    'Register Mother': 'Magrehistro ng Buntis',
    'Download Excel': 'I-download ang Excel',
    'Search...': 'Maghanap...',
  };

  const t = (enText: string, filText?: string): string => {
    if (lang === 'fil') {
      if (filText) return filText;
      if (translations[enText]) return translations[enText];
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
