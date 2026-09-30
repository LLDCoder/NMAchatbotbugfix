import React from "react";
import LeftSideSvg from "@/assets/icons/LeftSideSvg";
import RightSideSvg from "@/assets/icons/RightSideSvg";
import { useMediaQuery } from "@mantine/hooks";
import './index.less';
interface CarouselPaginationProps {
  currentIndex: number;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
  onDotClick: (index: number) => void;
}

const CarouselPagination: React.FC<CarouselPaginationProps> = ({
  currentIndex,
  totalSlides,
  onPrev,
  onNext,
  onDotClick,
}) => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  return (
    <div className="carousel-pagination carousel-pagination-left">
      {!isMobile && <div className="carousel-pagination-side" onClick={()=>currentIndex !== 0 && onPrev()}>
        <LeftSideSvg color={currentIndex !== 0 ? "#fff" : "#A7A7A74D"} />
      </div>}
      <div>
        <div className="carousel-pagination-dot-wrapper">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <div
              key={index}
              className={`carousel-pagination-dot ${
                currentIndex === index ? "carousel-pagination-dot-active" : ""
              }`}
              onClick={() => onDotClick(index)}
            ></div>
          ))}
        </div>
      </div>
      {!isMobile && <div className="carousel-pagination-side" onClick={()=>currentIndex !== totalSlides - 1 && onNext()}>
        <RightSideSvg
          color={currentIndex !== totalSlides - 1 ? "#fff" : "#A7A7A74D"}
        />
      </div>}
    </div>
  );
};

export default CarouselPagination;
