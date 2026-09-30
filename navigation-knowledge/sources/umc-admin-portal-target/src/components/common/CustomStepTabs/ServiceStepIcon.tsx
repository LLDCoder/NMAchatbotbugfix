import React from "react";

export type ServiceStepIconType =
  | "completed"
  | "workflow"
  | "certificate"
  | "rules";

interface ServiceStepIconProps {
  type: ServiceStepIconType;
}

const ServiceStepIcon: React.FC<ServiceStepIconProps> = ({ type }) => (
  <span
    aria-hidden="true"
    className={`service-step-icon service-step-icon--${type}`}
  >
    {type === "rules" && (
      <>
        <span className="service-step-icon__rules-top" />
        <span className="service-step-icon__rules-middle" />
        <span className="service-step-icon__rules-bottom" />
      </>
    )}
  </span>
);

export default ServiceStepIcon;
