export const PERSONAL_CENTER_EMPTY_VALUE = "-";

export interface PersonalCenterNamedItem {
    name?: string | null;
}

// GetAdminUserAsync already resolves department and role names in the requested language,
// so the page reads them straight off the profile instead of pulling the admin-only lists.
export function getResolvedNameLabels(
    items: PersonalCenterNamedItem[] | null | undefined,
) {
    if (!items?.length) {
        return [];
    }

    return items
        .map((item) => item.name?.trim() || null)
        .filter((label): label is string => Boolean(label));
}
