interface IBtnsEvent {
  preview?: () => void
  saveDraft?: () => void
  submit?: () => void
  publish?: () => void
  back?: () => void
}

interface IProps {
  btnsEvent: IBtnsEvent
  saveDraftDisabled?: boolean
  actionBtnsDisabled?: boolean
}

export type { IBtnsEvent, IProps }
