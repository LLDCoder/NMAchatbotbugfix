# ReportsAnalytics API Gap Analysis

This page is now aligned with the latest checked-in backend docs under this folder.

## Remaining assumptions

### Service Performance dimension selector
- The frontend now treats the selector as the backend `option` parameter, using `AllServices` and `AllCategories`.
- The previous category-filter interpretation has been removed.

### Export filenames
- Export endpoints are wired, but the frontend still uses deterministic fallback filenames because the docs do not guarantee a `Content-Disposition` filename.

### Metric deltas
- Table deltas are still rendered as percent deltas because the backend docs provide change fields without a separate unit contract.

## Compatibility handling kept in the frontend

### Service Operations type aliases
- `Renewal` is shown as `Renew`
- `Amendment` is shown as `Modify`
- `Cancellation` is shown as `Cancel`

### License trend coverage
- The chart now includes the additional documented license types such as `Press Card License` and `Marine Photography Permit`.

### License user types
- The frontend now includes `Establishment` in both the top user-type chart mapping and the bottom distribution table mapping.
