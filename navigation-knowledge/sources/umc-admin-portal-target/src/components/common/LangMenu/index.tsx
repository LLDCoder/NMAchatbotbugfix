import { useTranslation } from 'react-i18next';
import { isArabicLanguage } from "@/localization/language";

import './index.less';
interface ILangMenuProps {
    lang: string;
    onChange: (lang: string) => void;
}

export default function LangMenu({ lang, onChange }: ILangMenuProps){
    const { i18n, t } = useTranslation();
    const isRtl = isArabicLanguage(lang);
    const nextLanguage = isRtl ? "en" : "ar";

    const handleLanguageChange = (lng: string) => {
        i18n.changeLanguage(lng);
        localStorage.setItem("language", lng);
        onChange(lng);
    };

    return <button
        type="button"
        className={`lang-selector${isRtl ? " lang-selector--rtl" : ""}`}
        aria-label={t(isRtl ? "common.switchToEnglish" : "common.switchToArabic")}
        onClick={() => handleLanguageChange(nextLanguage)}
    >
        <span className="lang-selector__label" aria-hidden="true">
            {isRtl ? "En" : "Ar"}
        </span>
    </button>
}
