import React from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', nativeName: 'मराठी' },
  { code: 'gu', label: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'ta', label: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'bn', label: 'Bengali', nativeName: 'বাংলা' },
  { code: 'pa', label: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'ml', label: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'or', label: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'ur', label: 'Urdu', nativeName: 'اردو' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <select
      value={i18n.resolvedLanguage}
      onChange={changeLanguage}
      className="bg-transparent border border-white/20 text-white text-sm rounded-md px-2 py-1 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 hover:bg-white/10 transition-colors"
      aria-label="Select Language"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code} className="text-black bg-white">
          {lang.nativeName} ({lang.label})
        </option>
      ))}
    </select>
  );
}
