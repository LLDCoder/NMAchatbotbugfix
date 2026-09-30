interface IItem {
  name: string
  value: number
  icon: string
  key: string
}

interface IProps {
  countList: IItem[]
}

export type { IProps, IItem }