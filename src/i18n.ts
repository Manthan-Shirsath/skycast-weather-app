import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/translation.json';
import hi from './locales/hi/translation.json';
import mr from './locales/mr/translation.json';
import gu from './locales/gu/translation.json';
import ta from './locales/ta/translation.json';
import te from './locales/te/translation.json';
import kn from './locales/kn/translation.json';
import bn from './locales/bn/translation.json';
import pa from './locales/pa/translation.json';
import ml from './locales/ml/translation.json';
import or from './locales/or/translation.json';
import ur from './locales/ur/translation.json';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  mr: { translation: mr },
  gu: { translation: gu },
  ta: { translation: ta },
  te: { translation: te },
  kn: { translation: kn },
  bn: { translation: bn },
  pa: { translation: pa },
  ml: { translation: ml },
  or: { translation: or },
  ur: { translation: ur },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

const fontMap: Record<string, string> = {
  hi: 'Noto+Sans+Devanagari',
  mr: 'Noto+Sans+Devanagari',
  gu: 'Noto+Sans+Gujarati',
  ta: 'Noto+Sans+Tamil',
  te: 'Noto+Sans+Telugu',
  kn: 'Noto+Sans+Kannada',
  bn: 'Noto+Sans+Bengali',
  pa: 'Noto+Sans+Gurmukhi',
  ml: 'Noto+Sans+Malayalam',
  or: 'Noto+Sans+Oriya',
  ur: 'Noto+Sans+Arabic',
};

function updateLanguageSettings(lng: string) {
  // RTL Support
  document.documentElement.dir = lng === 'ur' ? 'rtl' : 'ltr';

  // Dynamic Font Loading
  const fontName = fontMap[lng];
  const linkId = 'dynamic-lang-font';
  let link = document.getElementById(linkId) as HTMLLinkElement;
  
  if (fontName) {
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;600;700&display=swap`;
    document.documentElement.style.fontFamily = `"${fontName.replace(/\+/g, ' ')}", sans-serif`;
  } else {
    if (link) {
      link.remove();
    }
    document.documentElement.style.fontFamily = ''; // Reset to default (e.g. Tailwind sans)
  }
}

i18n.on('languageChanged', (lng) => {
  updateLanguageSettings(lng);
});

// Set initial direction and font
updateLanguageSettings(i18n.resolvedLanguage || 'en');

export default i18n;
