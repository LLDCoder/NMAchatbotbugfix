import type { ReactElement } from "react";

import acquaintanceFormIcon from "./acquaintance-form.svg";
import addressListIcon from "./address-list.svg";
import addressPickerIcon from "./address-picker.svg";
import beneficiaryTypeIcon from "./beneficiary-type.svg";
import bookListIcon from "./book-list.svg";
import bookTradingFormIcon from "./book-trading-form.svg";
import containerIcon from "./container.svg";
import countryDropdownIcon from "./country-dropdown.svg";
import dataFormIcon from "./data-form.svg";
import dataListIcon from "./data-list.svg";
import datePickerIcon from "./date-picker.svg";
import dateRangeIcon from "./date-range.svg";
import dividerIcon from "./divider.svg";
import durationIcon from "./duration.svg";
import emiratePortIcon from "./emirate-port.svg";
import filmAgeRatingIcon from "./film-age-rating.png";
import filmRescreeningFormIcon from "./film-rescreening-form.png";
import filmScreeningFormIcon from "./film-screening-form.png";
import filmingTeamIcon from "./filming-team.svg";
import filmingPurposeFormIcon from "./filming-purpose-form.png";
import gameDistributionFormIcon from "./game-distribution-form.png";
import gridIcon from "./grid.svg";
import guardianConsentDetailsIcon from "./guardian-consent-details.png";
import idSelectorIcon from "./id-selector.svg";
import imageListIcon from "./image-list.svg";
import informationIcon from "./information.svg";
import licenseInformationFormIcon from "./license-information-form.png";
import licenseTransferFormIcon from "./license-transfer-form.png";
import mobileNumberIcon from "./mobile-number.svg";
import moviePackageFormIcon from "./movie-package-form.png";
import multiFileIcon from "./multi-file.svg";
import multiSelectIcon from "./multi-select.svg";
import multipleActivitiesIcon from "./multiple-activities.svg";
import multipleDropdownIcon from "./multiple-dropdown.svg";
import multipleLanguagesIcon from "./multiple-languages.svg";
import newspaperMagazineCirculationIcon from "./newspaper-magazine-circulation.png";
import numberputIcon from "./numberput.svg";
import partnerListIcon from "./partner-list.svg";
import personInChargeIcon from "./person-in-charge.svg";
import posterTrailerIcon from "./poster-trailer.svg";
import pressCardSelectorIcon from "./press-card-selector.svg";
import profileFormIcon from "./profile-form.png";
import publicationFormIcon from "./publication-form.svg";
import scriptPublicationFormIcon from "./script-publication-form.svg";
import singleActivityIcon from "./single-activity.svg";
import singleDropdownIcon from "./single-dropdown.svg";
import singleLanguageIcon from "./single-language.svg";
import singleSelectIcon from "./single-select.svg";
import socialMediaAccountIcon from "./social-media-account.svg";
import socialMediaManagerIcon from "./social-media-manager.svg";
import textAreaIcon from "./text-area.svg";
import textInputIcon from "./text-input.svg";
import tradeLicenseDetailsIcon from "./trade-license-details.png";
import transferHistoryIcon from "./transfer-history.svg";
import transferInformationIcon from "./transfer-information.png";
import uploadDraggerIcon from "./upload-dragger.svg";
import uploadIcon from "./upload.svg";
import urlListIcon from "./url-list.svg";
import videoIcon from "./video.svg";
import videoGamePackageFormIcon from "./video-game-package-form.png";

function createResourceIcon(src: string): ReactElement {
  return (
    <span className="designable-resource-icon" aria-hidden="true">
      <img
        className="designable-resource-icon__image"
        src={src}
        width={20}
        height={20}
        alt=""
      />
    </span>
  );
}

export const resourceIcons = {
  acquaintanceForm: createResourceIcon(acquaintanceFormIcon),
  addressList: createResourceIcon(addressListIcon),
  addressPicker: createResourceIcon(addressPickerIcon),
  beneficiaryType: createResourceIcon(beneficiaryTypeIcon),
  bookList: createResourceIcon(bookListIcon),
  bookTradingForm: createResourceIcon(bookTradingFormIcon),
  container: createResourceIcon(containerIcon),
  countryDropdown: createResourceIcon(countryDropdownIcon),
  dataForm: createResourceIcon(dataFormIcon),
  dataList: createResourceIcon(dataListIcon),
  datePicker: createResourceIcon(datePickerIcon),
  dateRange: createResourceIcon(dateRangeIcon),
  divider: createResourceIcon(dividerIcon),
  duration: createResourceIcon(durationIcon),
  emiratePort: createResourceIcon(emiratePortIcon),
  filmAgeRating: createResourceIcon(filmAgeRatingIcon),
  filmRescreeningForm: createResourceIcon(filmRescreeningFormIcon),
  filmScreeningForm: createResourceIcon(filmScreeningFormIcon),
  filmingTeam: createResourceIcon(filmingTeamIcon),
  filmingPurposeForm: createResourceIcon(filmingPurposeFormIcon),
  gameDistributionForm: createResourceIcon(gameDistributionFormIcon),
  grid: createResourceIcon(gridIcon),
  guardianConsentDetails: createResourceIcon(guardianConsentDetailsIcon),
  idSelector: createResourceIcon(idSelectorIcon),
  imageList: createResourceIcon(imageListIcon),
  information: createResourceIcon(informationIcon),
  licenseInformationForm: createResourceIcon(licenseInformationFormIcon),
  licenseTransferForm: createResourceIcon(licenseTransferFormIcon),
  mobileNumber: createResourceIcon(mobileNumberIcon),
  moviePackageForm: createResourceIcon(moviePackageFormIcon),
  multiFile: createResourceIcon(multiFileIcon),
  multiSelect: createResourceIcon(multiSelectIcon),
  multipleActivities: createResourceIcon(multipleActivitiesIcon),
  multipleDropdown: createResourceIcon(multipleDropdownIcon),
  multipleLanguages: createResourceIcon(multipleLanguagesIcon),
  newspaperMagazineCirculation: createResourceIcon(
    newspaperMagazineCirculationIcon,
  ),
  numberput: createResourceIcon(numberputIcon),
  partnerList: createResourceIcon(partnerListIcon),
  personInCharge: createResourceIcon(personInChargeIcon),
  posterTrailer: createResourceIcon(posterTrailerIcon),
  pressCardSelector: createResourceIcon(pressCardSelectorIcon),
  profileForm: createResourceIcon(profileFormIcon),
  publicationForm: createResourceIcon(publicationFormIcon),
  scriptPublicationForm: createResourceIcon(scriptPublicationFormIcon),
  singleActivity: createResourceIcon(singleActivityIcon),
  singleDropdown: createResourceIcon(singleDropdownIcon),
  singleLanguage: createResourceIcon(singleLanguageIcon),
  singleSelect: createResourceIcon(singleSelectIcon),
  socialMediaAccount: createResourceIcon(socialMediaAccountIcon),
  socialMediaManager: createResourceIcon(socialMediaManagerIcon),
  textArea: createResourceIcon(textAreaIcon),
  textInput: createResourceIcon(textInputIcon),
  tradeLicenseDetails: createResourceIcon(tradeLicenseDetailsIcon),
  transferHistory: createResourceIcon(transferHistoryIcon),
  transferInformation: createResourceIcon(transferInformationIcon),
  upload: createResourceIcon(uploadIcon),
  uploadDragger: createResourceIcon(uploadDraggerIcon),
  urlList: createResourceIcon(urlListIcon),
  video: createResourceIcon(videoIcon),
  videoGamePackageForm: createResourceIcon(videoGamePackageFormIcon),
} as const;
