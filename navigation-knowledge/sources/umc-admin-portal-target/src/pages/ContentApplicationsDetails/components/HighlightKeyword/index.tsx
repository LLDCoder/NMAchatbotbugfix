import React from "react";
import "./index.less";

interface HighlightKeywordProps {
  text: string;          // original text
  keyword: string | string[];  // keyword(s) to highlight
  highlightClass?: string;  // custom highlight class name
  caseSensitive?: boolean;  // whether to match case sensitively
}

const HighlightKeyword: React.FC<HighlightKeywordProps> = ({
  text,
  keyword,
  highlightClass = "highlight",
  caseSensitive = false,
}) => {
  // is empty ? return original text
  if (!text.trim()) {
    return <span>{text}</span>;
  }

  // single keyword -> keyword array
  const keywords = Array.isArray(keyword) ? keyword : [keyword];
  
  // filter keyword array to remove empty strings
  const validKeywords = keywords.filter(k => k.trim());
  
  // no validkeywords ? return original text
  if (validKeywords.length === 0) {
    return <span>{text}</span>;
  }

  // transform
  const escapedKeywords = validKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regexPattern = escapedKeywords.join("|");
  const regex = new RegExp(`(${regexPattern})`, caseSensitive ? "g" : "gi");

  // split and highlight
  const highlightedParts = text.split(regex).map((part, index) => {
    // is match ?
    const isMatch = validKeywords.some(k => 
      caseSensitive ? part === k : part.toLowerCase() === k.toLowerCase()
    );
    
    if (isMatch) {
      // find match keyword from validKeywords array
      const matchedKeyword = validKeywords.find(k => 
        caseSensitive ? part === k : part.toLowerCase() === k.toLowerCase()
      ) || "";
      
      return (
        <span key={index} className={highlightClass} data-keyword={matchedKeyword}>
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });

  return <>{highlightedParts}</>;
};

export default HighlightKeyword;