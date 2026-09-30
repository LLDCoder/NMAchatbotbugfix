import serviceAdvisor from "@/assets/images/ai-chatbot-avatar.png";
import "./Mascot.less";

interface MascotProps {
  large?: boolean;
}

export function Mascot({ large = false }: MascotProps) {
  return (
    <span
      aria-hidden="true"
      className={`ai-chatbot__mascot ${large ? "ai-chatbot__mascot-large" : ""}`}
    >
      <img alt="" src={serviceAdvisor} />
    </span>
  );
}
