import type { ApprovesResponseDto } from "@/services/userManagement"

const Sorter = {
  ascend: 0,
  descend: 1
} as const

const SorterKeys = {
  ascend: 'ascend',
  descend: 'descend',
} as const

const DtoAdapter = {
  createdOn: "CreatedOn",
  updateOn: "UpdateOn",
  userTypeId: "UserTypeId",
} as Partial<{
  readonly[key in keyof ApprovesResponseDto]: string
}>

type TSorter = typeof Sorter

// single sort rule
interface ISortRule {
  sortOrder: TSorter[keyof TSorter]
  sortField: keyof ApprovesResponseDto | string
}

export { Sorter, DtoAdapter, SorterKeys } 
export type { TSorter, ISortRule }
