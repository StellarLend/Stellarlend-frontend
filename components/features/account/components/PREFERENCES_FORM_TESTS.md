# PreferencesForm Test Plan

## Component

`components/features/account/components/PreferencesForm.tsx`

A client-side form that loads user preferences from `GET /api/account/preferences`, allows editing locale, display currency, and notification toggles, and persists changes via `PUT /api/account/preferences`.

## Test Scenarios

| # | Test | Description |
|---|------|-------------|
| 1 | Render all form fields | Verify locale select, currency select, notification checkboxes, and submit button are present after load. |
| 2 | Empty locale validation | Select an empty locale value and submit; assert "Locale is required." appears. |
| 3 | Empty locale and currency | Clear both locale and currency and submit; assert both required errors appear. |
| 4 | Successful save payload | Mock a 200 response, submit valid data, and assert fetch was called with the correct URL, method, headers, and JSON body. |
| 5 | Success confirmation | After a successful save, verify "Preferences saved successfully." is rendered. |
| 6 | Error banner on failure | Mock a 500 response and assert the global error message appears. |
| 7 | Unchanged-form submit | Submit the form without changes (pre-loaded valid defaults) and verify the API is still called and success is shown. |
| 8 | Accessible status announcement | After a successful save, verify `role="status"` element is present with the success message. |
| 9 | Server-side validation errors (422) | Mock a 422 response with field errors and verify they are displayed. |

## Running Tests

```bash
npm test -- PreferencesForm
```

## Edge Cases Covered

- Empty locale selection
- Empty currency selection (both fields simultaneously)
- Server failure (500)
- Server validation rejection (422)
- Unchanged form submission
- Accessible live-region announcements
