import React, { useState, useEffect, useRef, useMemo } from "react";
import { Carousel } from "antd";
import { CustomButton } from "@/components/common";
import BannerRoot from "@/assets/images/banner-root.png";
import StarIcon from "@/assets/images/star-icon.svg";
import AboutOne from "@/assets/images/about-one.png";
import AboutTwo from "@/assets/images/about-two.png";
import AboutThree from "@/assets/images/about-three.png";
import AboutFour from "@/assets/images/about-four.png";
import Footer4 from "@/assets/images/footer4.svg";
import ReachClock from "@/assets/images/reachClock.svg";
import ReachPhone from "@/assets/images/reachPhone.svg";
import ReachWhats from "@/assets/images/reachWhats.svg";
import ReachArea from "@/assets/images/reachArea.svg";
import FacebookIcon from "@/assets/images/facebookIcon.svg";
import InstagramIcon from "@/assets/images/instagramIcon.svg";
import YoutubeIcon from "@/assets/images/youtubeIcon.svg";
import XIcon from "@/assets/images/xIcon.svg";
import LinkedinIcon from "@/assets/images/linkedinIcon.svg";
import NowArrow from "@/assets/images/nowArrow.png";
import BannerEmpty from "@/assets/images/bannerEmpty.png";
import type {
  BannerItem,
  AboutParam,
  PartnershipParam,
  FooterParam,
} from "@/services/cms";
import {
  AuthenticatedDocumentImage,
  AuthenticatedDocumentVideo,
} from "@/components/common/AuthenticatedDocumentMedia";
import PreviewTopNav from "./sections/PreviewTopNav";
import PreviewServices from "./sections/PreviewServices";
import PreviewTrackRequest from "./sections/PreviewTrackRequest";
import PreviewKnowledgeHub from "./sections/PreviewKnowledgeHub";
import PreviewPartnership from "./sections/PreviewPartnership";
import PreviewMedia from "./sections/PreviewMedia";
import PreviewSubscribe from "./sections/PreviewSubscribe";
import PreviewFooterNav from "./sections/PreviewFooterNav";
import "./index.less";
import "./sections/sections.less";
import type { CarouselRef } from "antd/lib/carousel";
import CarouselPagination from "../CarouselPagination";
import { useTranslation } from "react-i18next";
import i18n from "@/localization/config";
interface PrviewProps {
  crrent: number;
  bannerList: BannerItem[];
  aboutData: AboutParam;
  partnershipData: PartnershipParam;
  footerData: FooterParam;
  lan: string;
  isModal?: boolean;
  mode?: "default" | "view" | "preview";
  isReject?: boolean;
  // Mobile device preview: banners swap to their dedicated mobile cover
  isMobile?: boolean;
  selectArea: (key: number) => void;
}

// Cover uploads accept image / MP4 / GIF; video files need a <video> element
const isVideoUrl = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url);

const PreviewContainer: React.FC<PrviewProps> = ({
  crrent,
  bannerList,
  lan,
  aboutData,
  partnershipData,
  footerData,
  mode = "default",
  isReject = false,
  isMobile = false,
  selectArea,
}) => {
  const { t } = useTranslation();
  const tLan = useMemo(
    () => i18n.getFixedT(lan === "ar" ? "ar" : "en"),
    [lan],
  );
  const bannerRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const partnershipRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<CarouselRef>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  useEffect(() => {
    if (crrent === 1) {
      scrollToElement(bannerRef);
    } else if (crrent === 2) {
      scrollToElement(aboutRef);
    } else if (crrent === 3) {
      scrollToElement(partnershipRef);
    } else if (crrent === 4) {
      scrollToElement(footerRef);
    }
  }, [crrent]);
  const scrollToElement = (elementRef: React.RefObject<HTMLDivElement>) => {
    if (!elementRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const element = elementRef.current;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const scrollTop = elementRect.top - containerRect.top + container.scrollTop;

    container.scrollTo({
      top: scrollTop,
      behavior: "smooth",
    });
  };
  const getAboutIcon = (i: number) => {
    switch (i) {
      case 0:
        return AboutOne;
      case 1:
        return AboutTwo;
      case 2:
        return AboutThree;
      case 3:
        return AboutFour;
      default:
        return AboutOne;
    }
  };
  const getModeClassName = () => {
    switch (mode) {
      case "default":
        return "";
      case "view":
        return "preview-pattern";
      case "preview":
        return "preview-max";
      default:
        return "";
    }
  };
  const selectNow = (key: number) => {
    if (mode == "preview") return;
    selectArea(key);
  };
  const waterfallData = (aboutData?.highlights || []).map((item, index) => {
    return (
      <div className="waterfall-line">
        {(index + 1) % 2 == 0 ? (
          <>
            <div className="word-box">
              <img src={getAboutIcon(index)} alt="" />
              <div className="title">{item.title[lan]}</div>
              <div className="description">{item.description[lan]}</div>
            </div>
            <div className="img-box-hight">
              <AuthenticatedDocumentImage src={aboutData.images[index * 2]} alt="" />
            </div>
            <div className="img-box">
              <AuthenticatedDocumentImage
                src={aboutData.images[index * 2 + 1]}
                alt=""
              />
            </div>
          </>
        ) : (
          <>
            <div className={index !== 3 ? "img-box-hight" : "img-box"}>
              <AuthenticatedDocumentImage src={aboutData.images[index * 2]} alt="" />
            </div>
            <div className="word-box">
              <img src={getAboutIcon(index)} alt="" />
              <div className="title">{item.title[lan]}</div>
              <div className="description">{item.description[lan]}</div>
            </div>
            <div className={index === 3 ? "img-box-hight" : "img-box"}>
              <AuthenticatedDocumentImage
                src={aboutData.images[index * 2 + 1]}
                alt=""
              />
            </div>
          </>
        )}
      </div>
    );
  });
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div className="preview-wrapper">
      <div
        className={`prview-container ${getModeClassName()} ${isReject ? "reject" : ""
          }`}
        dir={lan === "ar" ? "rtl" : "ltr"}
        ref={containerRef}
      >
        {/* Banner */}
        <div
          onMouseDown={handleMouseDown}
          className={`shine-box ${crrent !== 1 && "shine-box-hide"}`}
          ref={bannerRef}
          onClick={() => selectNow(1)}
        >
          {crrent == 1 && (
            <div className="shine-tag">{t("CMS.pageManagementHome.modules.heroBanner")}</div>
          )}
          <div className="banner-box">
            <div className="banner-header">
              <PreviewTopNav lan={lan} />
            </div>
            <div className="banner-root">
              <img src={BannerRoot} alt="" />
            </div>
            <div className="preview-carousel">
              <Carousel
                ref={carouselRef}
                dots={false}
                autoplay
                afterChange={setCurrentIndex}
              >
                {bannerList.map((item) => {
                  const cover =
                    isMobile && item.mobileCover?.url
                      ? item.mobileCover
                      : item.cover;
                  return (
                    <div className="carousel-item">
                      {cover.url && isVideoUrl(cover.url) ? (
                        <AuthenticatedDocumentVideo
                          src={cover.url}
                          autoPlay
                          muted
                          loop
                          playsInline
                        />
                      ) : (
                        <AuthenticatedDocumentImage
                          src={cover.url}
                          fallbackSrc={BannerEmpty}
                          alt=""
                        />
                      )}
                      <div className="banner-content">
                        <img src={StarIcon} alt="" />
                        <div className="title">{item?.title[lan]}</div>
                        <div className="description">{item?.description[lan]}</div>
                        <div className="btn-group">
                          {item?.primaryButton.enabled && (
                            <div className="primary-btn">
                              {item?.primaryButton.label[lan]}
                              <img src={NowArrow} alt="" />
                            </div>
                          )}
                          {item?.secondaryButton.enabled && (
                            <div className="secondary-btn">
                              {item?.secondaryButton.label[lan]}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Carousel>
              <CarouselPagination
                currentIndex={currentIndex}
                totalSlides={bannerList.length}
                onPrev={() => carouselRef.current?.prev()}
                onNext={() => carouselRef.current?.next()}
                onDotClick={(index) => carouselRef.current?.goTo(index)}
              />
            </div>
          </div>
        </div>
        <PreviewServices lan={lan} />
        <PreviewTrackRequest lan={lan} />
        <PreviewKnowledgeHub lan={lan} />
        {/* About Us */}
        <div
          className={`shine-box ${crrent !== 2 && "shine-box-hide"}`}
          ref={aboutRef}
          onClick={() => selectNow(2)}
        >
          {crrent == 2 && <div className="shine-tag">{t("CMS.pageManagementHome.modules.aboutUs")}</div>}
          <div className="about-box">
            <div className="content-box">
              <div className="fourTitle">{aboutData?.title[lan]}</div>
              <div className="fourSubtitle">{aboutData?.subTitle[lan]}</div>
              <div className="fourRemarks">{aboutData?.description[lan]}</div>
              <div className="learn-btn">
                {aboutData?.button.label[lan]}
                <img src={NowArrow} alt="" />
              </div>
            </div>
            <div className="waterfall-box">{waterfallData}</div>
          </div>
        </div>
        {/* Partnership */}
        <div
          className={`shine-box ${crrent !== 3 && "shine-box-hide"}`}
          ref={partnershipRef}
          onClick={() => selectNow(3)}
        >
          {crrent == 3 && (
            <div className="shine-tag">{t("CMS.pageManagementHome.modules.partnership")}</div>
          )}
          <PreviewPartnership partnershipData={partnershipData} />
        </div>
        <PreviewMedia lan={lan} />
        {/* Footer */}
        <div
          className={`shine-box ${crrent !== 4 && "shine-box-hide"}`}
          ref={footerRef}
          onClick={() => selectNow(4)}
        >
          {crrent == 4 && <div className="shine-tag">{t("CMS.pageManagementHome.modules.footer")}</div>}
          <div className="footer-box">
            <div className="top-line">
              <div className="subscribe-newsletter">
                <PreviewSubscribe lan={lan} />
              </div>
              <div className="reach-Us">
                <div className="reach-title">
                  {footerData?.contactCard?.title[lan] || tLan("CMS.preview.reachUs")}
                </div>
                <div className="reach-content">
                  <div className="filed-list">
                    <div className="filed-item">
                      <img className="filed-icon" src={ReachClock} alt="" />
                      <div className="filed-value">
                        {footerData?.contactCard.businessHours?.[lan as 'en' | 'ar'] ||
                          footerData?.contactCard.businessHours?.en ||
                          "-"}
                      </div>
                    </div>
                    <div className="filed-item">
                      <img className="filed-icon" src={ReachPhone} alt="" />
                      <div className="filed-value underline">
                        {footerData?.contactCard.phoneNumber || "-"}
                      </div>
                    </div>
                    <div className="filed-item">
                      <img className="filed-icon" src={ReachWhats} alt="" />
                      <div className="filed-value underline">
                        {footerData?.contactCard.whatsApp || "-"}
                      </div>
                    </div>
                    <div className="filed-item">
                      <img className="filed-icon" src={ReachArea} alt="" />
                      <div className="filed-value underline">{tLan("CMS.preview.viewLocation")}</div>
                    </div>
                  </div>
                  <div className="pv-reach-logo">
                    <img src={Footer4} alt="" />
                  </div>
                </div>
              </div>
            </div>
            <div className="foot-content">
              <PreviewFooterNav lan={lan} />
            </div>
            <div className="foot-other">
              <div className="copyright">
                {tLan("CMS.preview.copyright")}
              </div>
              <div className="icon-list">
                {footerData?.socialMedia.facebook && (
                  <img src={FacebookIcon} alt="" />
                )}
                {footerData?.socialMedia.instagram && (
                  <img src={InstagramIcon} alt="" />
                )}
                {footerData?.socialMedia.youTube && (
                  <img src={YoutubeIcon} alt="" />
                )}
                {footerData?.socialMedia.x && <img src={XIcon} alt="" />}
                {footerData?.socialMedia.linkedIn && (
                  <img src={LinkedinIcon} alt="" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewContainer;
