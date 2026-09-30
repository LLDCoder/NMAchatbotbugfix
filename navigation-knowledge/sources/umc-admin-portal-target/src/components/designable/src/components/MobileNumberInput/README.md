# Dynamic Mobile Number Contract

The admin designer owns schema metadata. Customer application creation owns
runtime defaults and submission normalization.

Dynamic form hosts use `MobileNumberRuntimeProvider`. Admin designer and review
hosts provide an empty default country code. A dedicated create preview may
provide `+971` without writing it into the saved schema.

Field-level configuration has this precedence:

```ts
explicitDefaultCountryCode ?? runtimeDefaultCountryCode
```

New composite components should use `CompositeMobileNumberField`. Custom phone
layouts should call `useResolvedMobileNumberDefaultCountryCode`.

The default split-field contract is derived from the full-number field name:

```text
name
nameCountryCode
nameLocalNumber
```

Runtime readers also support `countryCodeFieldName` and
`localNumberFieldName` overrides from customer-compatible schemas.
