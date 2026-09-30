import { useEffect } from "react";
import { useHistory } from "react-router-dom";
import { useInspectionAccess } from "../InspectionCommon/access";

export default function Inspection() {
  const history = useHistory();
  const { defaultInspectionPath } = useInspectionAccess();

  useEffect(() => {
    history.replace(defaultInspectionPath);
  }, [defaultInspectionPath, history]);

  return null;
}
