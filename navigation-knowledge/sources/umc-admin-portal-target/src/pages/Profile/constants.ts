import { Sorter, type ISortRule } from "./type";

const DefaultSortRule: ISortRule = {
  sortOrder: Sorter.ascend,
  sortField: "statusId",
}

export { DefaultSortRule }