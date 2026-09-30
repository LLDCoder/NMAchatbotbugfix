// Browser regression harness; loaded only by the local boundary test script.
import React from "react";
import ReactDOM from "react-dom";
import { useDshChat } from "../src/components/AIChatBot/model/dshWorkflow";
import { ChatPanel } from "../src/components/AIChatBot/components/ChatPanel";
import i18n from "../src/localization/config";
import { MarkdownContent } from "../src/components/AIChatBot/components/MarkdownContent";
export function mountBoundaryHarness(language: "en" | "ar", markdown = "") {
  void i18n.changeLanguage(language);
  const host = document.getElementById("boundary-harness") || document.body.appendChild(document.createElement("div"));
  host.id = "boundary-harness";
  host.style.cssText = "position:fixed;inset:0;background:white;z-index:999999;padding:30px;overflow:auto";
  function Harness() {
    const chat = useDshChat(language);
    (window as any).__boundaryChat = chat;
    return <div dir={language === "ar" ? "rtl" : "ltr"}>
      <h1>Boundary regression</h1>
      <div style={{position:"relative", width:650, height:850, float:"right"}}><ChatPanel customerChat={chat} language={language} fullscreen={false}
        onClose={() => chat.cancelPending()} onFullscreenChange={() => undefined} /></div>
      <MarkdownContent content={markdown} />
    </div>;
  }
  ReactDOM.unmountComponentAtNode(host);
  ReactDOM.render(<Harness />, host);
}
