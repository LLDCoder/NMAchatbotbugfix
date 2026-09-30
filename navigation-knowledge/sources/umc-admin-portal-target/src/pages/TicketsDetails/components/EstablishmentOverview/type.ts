interface IProps {
  details: {
    profileId: number;
  }
}

const ID_TYPE_MAP: Record<string, string> = {
  "Emirates ID": "emiratesId",
  "Passport ID": "passportNumber",
  UID: "uid",
}

const ID_NAME_MAP: Record<string, string> = {
  emiratesId: "Emirates ID",
  passportNumber: "Passport Number",
  uid: "UID",
}

export { ID_TYPE_MAP, ID_NAME_MAP }
export type { IProps }
