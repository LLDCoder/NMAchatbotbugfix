import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import loginBack from '@/assets/images/login-back.png';
import publicLogo from '@/assets/images/public-logo.png';
import publicTitle from '@/assets/images/public-title.png';
import LangMenu from '@/components/common/LangMenu';

import './index.less';

export interface PublicAuthHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  logo?: string;
  title?: string;
}

export default function PublicAuthHeader({
  showBack = false,
  onBack,
  logo = publicLogo,
  title = publicTitle,
}: PublicAuthHeaderProps) {
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language || 'en');
  const isRtl = currentLang.toLowerCase().startsWith('ar');

  useEffect(() => {
    setCurrentLang(i18n.language || 'en');
  }, [i18n.language]);

  const handleLanguageChange = (lng: string) => {
    setCurrentLang(lng);
  };

  return (
    <div
      className={`public-auth-header${isRtl ? ' public-auth-header--rtl' : ''}`}
      dir="ltr"
    >
      <div className="public-auth-header__left">
        {showBack ? (
          <button
            type="button"
            className="public-auth-header__back"
            onClick={onBack}
            aria-label={t('common.back')}
          >
            <img src={loginBack} alt="" />
          </button>
        ) : (
          <div className="public-auth-header__back-placeholder" aria-hidden="true" />
        )}
      </div>
      <div className="public-auth-header__logo">
        <img className="public-auth-header__logo-icon" src={logo} alt="" />
        <img className="public-auth-header__logo-title" src={title} alt="" />
      </div>
      <div className="public-auth-header__right">
        <LangMenu lang={currentLang} onChange={handleLanguageChange} />
      </div>
    </div>
  );
}
