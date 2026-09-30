import { useLocation } from "react-router-dom";
import MessageLog from "./MessageLog";
import MessageLogDetail from "./MessageLogDetail";

const MESSAGE_LOG_DETAIL_PATH = "/communications/message-log/message-details";

export default function Communications() {
  const location = useLocation();

  if (location.pathname === MESSAGE_LOG_DETAIL_PATH) {
    return <MessageLogDetail />;
  }

  return <MessageLog />;
}
