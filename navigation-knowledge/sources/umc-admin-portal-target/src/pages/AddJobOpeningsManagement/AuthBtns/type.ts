interface IBtnsEvent {
  preview?: () => void
  saveDraft?: () => void
  submit?: () => void
  publish?: () => void
  back?: () => void
}

interface IProps {
  btnsEvent: IBtnsEvent
  btnsDisabled?: boolean
  canPublish?: boolean
  canSaveAndSubmit?: boolean
}

export type { IBtnsEvent, IProps }
