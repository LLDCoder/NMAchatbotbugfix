export const PERMISSION_CODES = {
  system: {
    permission: {
      create: "Settings.Roles.RoleDetails.PermissionCreate",
      edit: "Settings.Roles.RoleDetails.PermissionEdit",
      delete: "Settings.Roles.RoleDetails.PermissionDelete",
    },
    typeDictionary: {
      create: "Settings.UserManagement.TypeDictionaryCreate",
      edit: "Settings.UserManagement.TypeDictionaryEdit",
      delete: "Settings.UserManagement.TypeDictionaryDelete",
    },
    complianceLegal: {
      create: "Settings.ComplianceLegal.Create",
      edit: "Settings.ComplianceLegal.Edit",
      delete: "Settings.ComplianceLegal.Delete",
    },
  },
  communications: {
    broadcast: {
      send: "Settings.Broadcast.Send",
      publish: "Settings.Broadcast.Publish",
    },
    messageLog: {
      root: "Communications.MessageSendingLog",
      detail: "Communications.MessageSendingLog.Detail",
    },
  },
  licensing: {
    applications: {
      requestModification:
        "Licensing.Applications.ApplicationDetails.RequestModification",
      sendBack: "Licensing.Applications.ApplicationDetails.SendBack",
      externalApproval:
        "Licensing.Applications.ApplicationDetails.ExternalApproval",
    },
    reports: {
      export: "Licensing.ReportsAnalytics.Export",
    },
  },
  content: {
    applications: {
      sendBack: "Content.Applications.ConfirmSendBackModal",
      externalApproval: "Content.Applications.ConfirmExternalApprovalModal",
    },
    reports: {
      export: "Content.ReportsAnalytics.Export",
    },
  },
  cms: {
    pages: {
      homepage: {
        saveAndSubmit: "CMS.Pages.Homepage.SaveAndSubmit",
        publish: "CMS.Pages.Homepage.Publish",
      },
      aboutNma: {
        saveAndSubmit: "CMS.Pages.AboutNMA.SaveAndSubmit",
        publish: "CMS.Pages.AboutNMA.Publish",
      },
      leadership: {
        saveAndSubmit: "CMS.Pages.Leadership.SaveAndSubmit",
        publish: "CMS.Pages.Leadership.Publish",
      },
    },
  },
  common: {
    document: {
      upload: "Common.Document.Upload",
      download: "Common.Document.Download",
    },
  },
  customer: {
    tickets: {
      exportTeamTasks: "CustomerModule.Tickets.ExportTeamTasks",
    },
  },
  inspection: {
    task: {
      assign: "Inspection.TaskManagement.Queued",
      export: "Inspection.TaskManagement.ExportInspectionTaskManagement",
    },
    violation: {
      export: "Inspection.ViolationManagement.Export",
    },
    reports: {
      export: "Inspection.ReportsAnalytics.Export",
    },
    appeal: {
      export: "CustomerModule.Appeals.Export",
    },
  },
} as const;
