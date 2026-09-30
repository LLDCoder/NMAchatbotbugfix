using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using UMC.AdminPortal.Application.Dtos.Application;
using UMC.AdminPortal.Application.Dtos.Workflow;
using UMC.AdminPortal.Application.Services.WorkflowActions;
using UMC.AdminPortal.Domain.Models;
using UMC.AdminPortal.Domain.Service.UserInfo;
using UMC.AdminPortal.Domain.Shares;
using UMC.AdminPortal.Domain.Shares.Enums;
using UMC.AdminPortal.Infrastructure;
using UMC.Utils.Framework.Helps;
using UMC.Utils.Framework.GlobalException;
using UMC.Utils.Framework.Module.Attributes;

namespace UMC.AdminPortal.Application.Services.ApplicationMaterials;

public interface IApplicationMaterialStatusService
{
    Task<UpdateApplicationMaterialStatusResponse> UpdateAsync(
        UpdateApplicationMaterialStatusRequest request,
        string routeMaterialId,
        CancellationToken cancellationToken = default);

    Task<string?> GetReviewFormDataAsync(
        int applicationId,
        int applicationDetailId,
        CancellationToken cancellationToken = default);

    Task EnsureAllStatusesAssignedAsync(int applicationId, int applicationDetailId, CancellationToken cancellationToken = default);
}

[InjectOnScoped]
public sealed class ApplicationMaterialStatusService(
    AdminPortalDBContext db,
    ICurrentUserService currentUserService) : IApplicationMaterialStatusService
{
    internal const string MaterialStatusRequiredCode = "MATERIAL_STATUS_REQUIRED";
    private const string ServiceCode = "302";
    private const int MaterialTypeId = 14;
    private const string MaterialTypeCode = "MG";

    public async Task<UpdateApplicationMaterialStatusResponse> UpdateAsync(
        UpdateApplicationMaterialStatusRequest request,
        string routeMaterialId,
        CancellationToken cancellationToken = default)
    {
        if (request.ApplicationId <= 0
            || request.ApplicationDetailId <= 0
            || string.IsNullOrWhiteSpace(request.TaskId)
            || request.MaterialIndex < 0
            || request.Status is not (0 or 1))
            throw new MaterialStatusException("INVALID_MATERIAL_STATUS", "Material status must be 0 or 1.");

        if (!Guid.TryParse(routeMaterialId, out var routeId)
            || !Guid.TryParse(request.MaterialId, out var bodyId)
            || routeId != bodyId)
        {
            throw new MaterialStatusException("INVALID_MATERIAL_ID", "Material id is invalid or does not match the route.");
        }

        var application = await db.Applications
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.ApplicationId, cancellationToken);
        if (application == null || !string.Equals(application.ServiceCode, ServiceCode, StringComparison.Ordinal))
            throw new MaterialStatusException("APPLICATION_MATERIAL_NOT_FOUND", "Application material was not found.");

        if (!await db.ApplicationDetails.AsNoTracking().AnyAsync(
                x => x.Id == request.ApplicationDetailId && x.ApplicationId == request.ApplicationId,
                cancellationToken))
        {
            throw new MaterialStatusException("APPLICATION_MATERIAL_NOT_FOUND", "Application material was not found.");
        }

        try
        {
            await WorkflowTaskAuthorization.EnsureCurrentAssigneeCanActAsync(
                db,
                new TaskActionDto
                {
                    ApplicationId = request.ApplicationId,
                    ApplicationDetailId = request.ApplicationDetailId,
                    InstanceId = await db.CamundaTasks.AsNoTracking()
                        .Where(x => x.TaskId == request.TaskId)
                        .Select(x => x.ProcessInstanceId)
                        .FirstOrDefaultAsync(cancellationToken) ?? string.Empty,
                    TaskId = request.TaskId,
                    ServiceId = application.ServiceId
                },
                currentUserService.UserId,
                cancellationToken,
                (int)DepartmentEnum.Content);
        }
        catch (BusinessException exception) when (
            exception.Message is "Workflow.TaskNotFound" or "Workflow.TaskAlreadyCompleted")
        {
            throw new MaterialStatusException("TASK_NOT_ACTIONABLE", "The task is not actionable.");
        }
        catch (BusinessException)
        {
            throw new MaterialStatusException("MATERIAL_STATUS_FORBIDDEN", "The current user cannot update this material status.");
        }

        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(cancellationToken)
            : null;

        // FormDataValues is a JSON document, so two independent read/modify/write operations
        // could otherwise lose each other's material assignment. Serialize updates for the
        // application extension row on SQL Server before reading the document to be changed.
        var extension = transaction != null
            ? await db.ApplicationDetailsExts
                .FromSqlInterpolated($"SELECT * FROM [Extensions].[ApplicationDetailsExt] WITH (UPDLOCK, HOLDLOCK) WHERE [ApplicationDetailId] = {request.ApplicationDetailId}")
                .FirstOrDefaultAsync(cancellationToken)
            : await db.ApplicationDetailsExts
                .FirstOrDefaultAsync(
                    x => x.ApplicationDetailId == request.ApplicationDetailId,
                    cancellationToken);
        if (extension == null || string.IsNullOrWhiteSpace(extension.FormDataValues))
            throw new MaterialStatusException("APPLICATION_MATERIAL_NOT_FOUND", "Application material was not found.");

        var normalizedMaterialId = routeId.ToString();
        extension.FormDataValues = SetStatus(
            extension.FormDataValues,
            normalizedMaterialId,
            request.MaterialIndex,
            request.Status.Value);
        extension.UpdatedOn = DateTimeHelper.Now;
        await db.SaveChangesAsync(cancellationToken);
        if (transaction != null)
            await transaction.CommitAsync(cancellationToken);

        return new UpdateApplicationMaterialStatusResponse
        {
            MaterialId = normalizedMaterialId,
            Status = request.Status.Value
        };
    }

    public async Task<string?> GetReviewFormDataAsync(
        int applicationId,
        int applicationDetailId,
        CancellationToken cancellationToken = default)
    {
        var source = await (
            from detail in db.ApplicationDetails.AsNoTracking()
            join extension in db.ApplicationDetailsExts.AsNoTracking()
                on detail.Id equals extension.ApplicationDetailId
            where detail.ApplicationId == applicationId && detail.Id == applicationDetailId
            select new { extension.FormData, extension.FormDataValues })
            .FirstOrDefaultAsync(cancellationToken);

        return source == null ? null : MergeFormData(source.FormData, source.FormDataValues);
    }

    public async Task EnsureAllStatusesAssignedAsync(
        int applicationId,
        int applicationDetailId,
        CancellationToken cancellationToken = default)
    {
        var source = await (
            from application in db.Applications.AsNoTracking()
            join detail in db.ApplicationDetails.AsNoTracking()
                on application.Id equals detail.ApplicationId
            join extension in db.ApplicationDetailsExts.AsNoTracking()
                on detail.Id equals extension.ApplicationDetailId
            where application.Id == applicationId && detail.Id == applicationDetailId
             select new { application.ServiceCode, extension.FormDataValues, extension.FormData })
            .FirstOrDefaultAsync(cancellationToken);

        if (source == null || !string.Equals(source.ServiceCode, ServiceCode, StringComparison.Ordinal))
            return;

        var rows = ReadMaterialRows(source.FormDataValues ?? source.FormData);
        if (rows.Where(x => x.IsEligible).Any(x => ReadStatus(x.Row["status"]) == null))
        {
            throw new MaterialStatusException(
                MaterialStatusRequiredCode,
                "One or more Newspapers & Magazines materials do not have a status.",
                StatusCodes.Status409Conflict);
        }
    }

    internal static string SetStatus(string formDataValues, string materialId, int materialIndex, int status)
    {
        var storedRoot = ParseStoredNode(formDataValues)
            ?? throw new MaterialStatusException("APPLICATION_MATERIAL_NOT_FOUND", "Application material was not found.");
        var root = UnwrapFormDataValues(storedRoot);
        var rows = ReadMaterialRows(root);
        var matchingIdRows = rows
            .Where(x => string.Equals(ReadText(x.Row["materialId"]), materialId, StringComparison.OrdinalIgnoreCase))
            .ToList();

        MaterialRow? target = null;
        if (matchingIdRows.Count == 1)
        {
            target = matchingIdRows[0];
            if (target.MaterialIndex != materialIndex)
                throw new MaterialStatusException("MATERIAL_ID_CONFLICT", "Material id does not match the supplied material index.");
        }
        else if (matchingIdRows.Count > 1)
        {
            throw new MaterialStatusException("MATERIAL_ID_CONFLICT", "Material id is assigned to more than one row.");
        }

        if (target == null)
        {
            var indexRows = rows.Where(x => x.MaterialIndex == materialIndex && x.IsEligible).ToList();
            if (indexRows.Count != 1)
                throw new MaterialStatusException("APPLICATION_MATERIAL_NOT_FOUND", "Application material was not found.");

            target = indexRows[0];
            var existingId = ReadText(target.Row["materialId"]);
            if (!string.IsNullOrWhiteSpace(existingId))
                throw new MaterialStatusException("MATERIAL_ID_CONFLICT", "Material index is already bound to another material id.");
        }

        if (!target.IsEligible)
            throw new MaterialStatusException("MATERIAL_TYPE_NOT_ELIGIBLE", "Only Newspapers & Magazines materials can have a review status.");

        target.Row["materialId"] = materialId;
        target.Row["status"] = status;
        target.WriteBack();
        if (storedRoot is JsonObject envelope
            && envelope["formDataValues"] is JsonValue)
        {
            envelope["formDataValues"] = root.ToJsonString();
            return storedRoot.ToJsonString();
        }

        return root.ToJsonString();
    }

    internal static string? MergeFormData(string? formData, string? formDataValues)
    {
        var valuesRoot = ParseNode(formDataValues);
        if (valuesRoot == null)
            return formData;

        var formRoot = ParseNode(formData);
        if (formRoot == null)
            return valuesRoot.ToJsonString();

        if (formRoot is JsonArray formSteps && valuesRoot is JsonArray valueSteps)
        {
            for (var index = 0; index < formSteps.Count && index < valueSteps.Count; index++)
                MergeStep(formSteps[index], valueSteps[index]);
            return formRoot.ToJsonString();
        }

        if (formRoot is JsonArray singleStepTarget && singleStepTarget.Count == 1)
        {
            MergeStep(singleStepTarget[0], new JsonObject { ["formData"] = valuesRoot.DeepClone() });
            return formRoot.ToJsonString();
        }

        MergeFormValues(formRoot, valuesRoot);
        return formRoot.ToJsonString();
    }

    internal static bool HasIncompleteStatuses(string? formDataValues) =>
        ReadMaterialRows(formDataValues).Where(x => x.IsEligible).Any(x => ReadStatus(x.Row["status"]) == null);

    private static void MergeStep(JsonNode? targetStep, JsonNode? valueStep)
    {
        if (targetStep is not JsonObject target || valueStep is not JsonObject source)
            return;

        var targetFormData = ParseEmbeddedNode(target["formData"]);
        var sourceFormData = ParseEmbeddedNode(source["formData"]);
        if (targetFormData == null || sourceFormData == null)
            return;

        MergeFormValues(targetFormData, sourceFormData);
        target["formData"] = target["formData"] is JsonValue
            ? targetFormData.ToJsonString()
            : targetFormData;
    }

    private static void MergeFormValues(JsonNode target, JsonNode source)
    {
        if (target is not JsonObject targetObject || source is not JsonObject sourceObject)
            return;

        var values = sourceObject["formValues"] ?? sourceObject;
        targetObject["formValues"] = values.DeepClone();
        if (sourceObject["modifyOriginalFormValues"] != null)
            targetObject["modifyOriginalFormValues"] = sourceObject["modifyOriginalFormValues"]!.DeepClone();
    }

    private static List<MaterialRow> ReadMaterialRows(string? json) =>
        ReadMaterialRows(ParseNode(json));

    private static List<MaterialRow> ReadMaterialRows(JsonNode? root)
    {
        var rows = new List<MaterialRow>();
        if (root is JsonArray steps)
        {
            foreach (var step in steps)
            {
                if (step is not JsonObject stepObject || stepObject["formData"] == null)
                {
                    CollectRows(step, rows, static () => { });
                    continue;
                }

                var embedded = ParseEmbeddedNode(stepObject["formData"]);
                if (embedded == null)
                    continue;

                CollectRows(embedded, rows, () =>
                {
                    stepObject["formData"] = stepObject["formData"] is JsonValue
                        ? embedded.ToJsonString()
                        : embedded;
                });
            }
        }
        else
        {
            CollectRows(root, rows, static () => { });
        }

        return rows;
    }

    private static void CollectRows(JsonNode? formData, List<MaterialRow> rows, Action writeBack)
    {
        if (formData is not JsonObject formObject)
            return;

        var formValues = formObject["formValues"] as JsonObject ?? formObject;
        if (formValues["dataList"] is not JsonArray dataList)
            return;

        for (var index = 0; index < dataList.Count; index++)
        {
            if (dataList[index] is JsonObject row)
                rows.Add(new MaterialRow(row, rows.Count, writeBack));
        }
    }

    private static bool IsEligible(JsonObject row)
    {
        var typeId = ReadInt(row["materialTypeId"]) ?? ReadInt(row["customMaterialId"]);
        var typeCode = ReadText(row["materialTypeCode"] ?? row["code"]);
        if (typeId == MaterialTypeId || string.Equals(typeCode, MaterialTypeCode, StringComparison.OrdinalIgnoreCase))
            return true;

        var labels = new[]
        {
            ReadText(row["material_type"]),
            ReadText(row["materialType"]),
            ReadText(row["materialTypeName"]),
            ReadText(row["materialTypeNameEn"])
        };

        return labels.Any(label => IsNewspapersAndMagazinesLabel(label));
    }

    private static bool IsNewspapersAndMagazinesLabel(string? value)
    {
        var normalized = string.Join(
            " ",
            (value ?? string.Empty).Split(
                (char[]?)null,
                StringSplitOptions.RemoveEmptyEntries));

        return string.Equals(normalized, "Newspapers & Magazines", StringComparison.OrdinalIgnoreCase)
            || string.Equals(normalized, "Newspapers and Magazines", StringComparison.OrdinalIgnoreCase);
    }

    private static int? ReadStatus(JsonNode? value)
    {
        var status = ReadInt(value);
        return status is 0 or 1 ? status : null;
    }

    private static int? ReadInt(JsonNode? value)
    {
        if (value == null)
            return null;
        if (value is JsonValue jsonValue && jsonValue.TryGetValue<int>(out var number))
            return number;
        return int.TryParse(ReadText(value), out number) ? number : null;
    }

    private static string? ReadText(JsonNode? value)
    {
        if (value == null)
            return null;
        if (value is JsonValue jsonValue && jsonValue.TryGetValue<string>(out var text))
            return text?.Trim();
        return value.ToJsonString().Trim('"').Trim();
    }

    private static JsonNode? ParseNode(string? json)
    {
        var parsed = ParseStoredNode(json);
        return parsed == null ? null : UnwrapFormDataValues(parsed);
    }

    private static JsonNode? ParseStoredNode(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;
        try
        {
            return JsonNode.Parse(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static JsonNode UnwrapFormDataValues(JsonNode storedRoot)
    {
        if (storedRoot is JsonObject envelope
            && envelope["formDataValues"] is JsonValue formDataValues
            && formDataValues.TryGetValue<string>(out var embeddedValues))
        {
            // ApplicationDetailExt.FormDataValues is stored in both the legacy raw-array
            // shape and the newer { formDataValues, activityIds } envelope. Read the embedded
            // steps for validation while SetStatus preserves the outer envelope on write-back.
            return JsonNode.Parse(embeddedValues) ?? storedRoot;
        }

        return storedRoot;
    }

    private static JsonNode? ParseEmbeddedNode(JsonNode? value)
    {
        if (value is JsonValue jsonValue && jsonValue.TryGetValue<string>(out var json))
            return ParseNode(json);
        return value;
    }

    private sealed record MaterialRow(JsonObject Row, int MaterialIndex, Action WriteBack)
    {
        public bool IsEligible => ApplicationMaterialStatusService.IsEligible(Row);
    }
}

public sealed class MaterialStatusException(
    string code,
    string message,
    int statusCode = StatusCodes.Status400BadRequest) : Exception(message)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;
}
