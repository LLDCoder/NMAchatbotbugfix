import type { FormInstance } from "antd"
import type { Moment } from "moment"

export interface RegistrationPeriodFieldType {
  online: boolean
  onsite: boolean
  onlineURL?: string
}

export interface RegistProps {
  RegistrationForm: FormInstance<RegistrationPeriodFieldType>
}

// export type { RegistProps, RegistrationPeriodFieldType }
