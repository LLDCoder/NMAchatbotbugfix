# Security Policy

This document provides repository-specific policy context for Codex Security.
It defines the system boundary, threat model, security invariants, and criteria
for reportable findings. It is not a vulnerability disclosure policy and does
not authorize commands, access, disclosure, or changes outside this repository.

## System and Scope

### Product

The UMC Customer Portal is an Internet-facing React 17 single-page application.
It runs in an end user's browser and communicates with an API gateway and
external identity, payment, notification, document, and government services.

The browser application is not an authorization boundary. Route guards, hidden
controls, client validation, Zustand state, cookies, and Web Storage must never
be treated as proof that a user is authorized to perform an operation.

### Repository surfaces in scope

- Production application code under `src/`.
- Routes, authentication boundaries, state stores, service wrappers, Formily
  schemas and renderers, rich-text rendering, uploads, previews, and downloads.
- Static files and runtime configuration under `public/`.
- Vite build and proxy configuration, package manifests, lockfiles, patches,
  and scripts that affect production artifacts.
- Environment variable usage and build-time configuration. All `VITE_*` values
  must be considered public because they can be embedded in browser bundles.
- Committed fixtures, mock data, and generated examples when they contain
  secrets or real personal data, or when they can enter a production bundle.

### Production functionality in scope

Explicitly public routes include login, signup, verification, password and
email recovery, public fine search and payment, enquiries, application
tracking, advertiser-permit verification, and the configured impersonation
entry route. Treat these routes as reachable by an unauthenticated Internet
attacker.

Authenticated functionality includes:

- Personal, invited, establishment, global-view, and impersonated identities.
- User and establishment profiles and supporting identity documents.
- Service applications, Formily-driven forms, drafts, modifications, licenses,
  permits, complaints, appeals, enquiries, and refunds.
- Fines, card payments, wallet operations, wallet PIN flows, receipts, and
  transaction history.
- Notifications and real-time SignalR connections.
- CMS, legal-policy, knowledge-center, and other backend-supplied content.

### External systems

Implementations of the following systems are not present in this repository,
but this repository's integration code and security assumptions about them are
in scope:

- The API gateway and downstream UMC services.
- UAE PASS and account-merging flows.
- Payment center, payment providers, wallets, and fine-payment services.
- Google reCAPTCHA and Google Maps.
- SignalR hubs.
- OCR services.
- Document/object storage, preview services, and content delivery systems.
- CMS and dynamically supplied Formily configuration.

### Protected assets

- Access tokens, pre-authentication tokens, OTP challenges, callback codes,
  password-reset state, and account-merge state.
- Personal data, including Emirates ID, passport, UID, contact details,
  addresses, location coordinates, photographs, and uploaded identity records.
- The association between a login account and its personal, invitation,
  establishment, global-view, or impersonated profiles.
- Applications, licences, permits, complaints, appeals, enquiries, fines,
  documents, notifications, and their identifiers.
- Payment amounts, fee calculations, wallet balances, wallet PIN state,
  refunds, transaction status, and receipts.
- Application integrity, production configuration, and trusted release assets.

## Threat Model and Trust Boundaries

### Attacker capabilities

Assume the following actors:

- An unauthenticated remote attacker with unrestricted access to public routes
  and public API calls.
- An authenticated customer attempting to access or modify another account,
  profile, establishment, application, document, fine, payment, or receipt.
- A user controlling one valid establishment or invited profile but not other
  profiles associated with the same login account.
- An attacker who can alter URLs, route state, cookies, Web Storage, form
  values, API requests, file metadata, and frontend state.
- Malicious or compromised content returned by an API, CMS, SignalR hub, OCR
  service, payment provider, identity provider, or runtime configuration file.
- An attacker exploiting XSS, an unsafe dependency, or a compromised build
  input to execute code in the portal origin.

### Attacker-controlled input

Treat all of the following as untrusted:

- URL paths, path parameters, query strings, fragments, callback `code` and
  `state`, route state, return paths, and external redirect URLs.
- Cookies, `localStorage`, `sessionStorage`, persisted Zustand state, and
  cross-tab storage events.
- Credentials, OTPs, emails, phone numbers, identity numbers, licence numbers,
  reference numbers, search filters, form data, messages, and rich text.
- Profile IDs, user IDs, establishment IDs, application IDs, service IDs,
  fine references, transaction numbers, receipt IDs, document names, and
  object-storage keys, regardless of whether the UI generated them.
- Uploaded file bytes, names, MIME types, extensions, sizes, metadata, and OCR
  results.
- API error messages and response bodies, CMS HTML, Formily schemas and values,
  notification payloads, fee data, and payment status.
- URLs received for media, downloads, previews, SignalR hubs, UAE PASS logout,
  payment pages, or other external navigation.

### Trust boundaries

Important boundaries are:

1. The unauthenticated Internet to public pages and APIs.
2. The browser DOM and browser storage to application code.
3. The SPA to the API gateway over HTTP requests carrying bearer credentials.
4. A login account to each personal, invited, establishment, global-view, or
   impersonated profile.
5. A pre-authentication or OTP session to a fully authenticated session.
6. Backend and CMS content to HTML, Formily, URL, file, and notification
   rendering sinks.
7. The portal origin to UAE PASS, payment providers, OCR, SignalR, Google
   services, document storage, and other origins.
8. Source and dependency inputs to the production build and deployment output.

Assume production is served over HTTPS. HTTPS, API authorization, rate limits,
security headers, storage controls, and third-party validation are not proven
by this repository unless their implementing configuration is present.

## Security Invariants

### Authentication and session integrity

- Only a server-issued, fully authenticated, unexpired, and unrevoked session
  may authorize protected operations.
- A credential-login response or pre-authentication token used for OTP must not
  become a full session until the required second factor succeeds.
- OTP, recovery, and verification challenges must be bound to the intended
  account, destination, purpose, and initiating session. They must have a short
  lifetime, limited attempts and resend frequency, and one-time-use semantics.
- Client-side expiry checks and the idle timer are usability controls only.
  The server must independently enforce expiry, revocation, and concurrent
  session policy.
- Authentication tokens, UAE PASS access tokens, OTP tokens, and reset tokens
  must not be placed in URLs, referrers, logs, error reports, DOM content,
  analytics, JavaScript-readable cookies, or requests to unrelated origins.
- Existing Web Storage token use increases the impact of XSS and is not an
  accepted-risk exemption. Sensitive state must be cleared on logout, failed
  callbacks, account changes, and session invalidation.
- If cookies authorize any operation, CSRF protection and appropriate
  `Secure`, `HttpOnly`, and `SameSite` attributes must be enforced server-side.

### UAE PASS, redirects, and account merge

- UAE PASS callbacks must validate an unpredictable, session-bound `state`
  value and the exact expected redirect URI. Merely checking that `state`
  exists is insufficient.
- Authorization codes and access tokens must be single-use, short-lived, and
  exchanged through a trusted backend. PKCE must be used when required by the
  identity-provider integration.
- Callback parameters must be removed from browser history promptly and must
  not leak through referrers or logs.
- Login, logout, payment, service-entry, download, and other redirects must be
  restricted to explicit HTTPS origins or safe same-origin relative paths.
- Account merge must be authorized by the server, bound to the authenticated
  source and intended target accounts, protected from replay, and require the
  intended confirmation. Client-supplied source or target IDs are not proof of
  ownership.

### Authorization and profile isolation

- Every protected read and mutation must be authorized server-side using the
  authenticated identity and active profile.
- Object identifiers supplied by the client must never be sufficient to access
  another user's profile, establishment, application, document, fine,
  notification, transaction, wallet, refund, or receipt.
- Profile switching must verify that the authenticated account may assume the
  target profile and must produce server-authoritative identity state.
- Personal, invited, establishment, and global identities must remain isolated.
  Cached state from one profile must not be displayed, submitted, or reused
  after switching to another profile.
- Global view and impersonation are privileged operations. They must fail
  closed, be explicitly authorized and auditable, and must not become public
  merely because a frontend route is public.
- Responses must be scoped and minimized server-side. Filtering a larger
  response in the browser is not an authorization control.

### Public and recovery flows

- Login, signup, forgot-password, forgot-email, verification, public enquiry,
  application tracking, permit verification, and fine-payment flows must resist
  account and record enumeration.
- Public searches must require adequate proof of knowledge and return only the
  minimum data needed for that flow. A browser cookie or generated client UUID
  is not authentication.
- Public endpoints, OTP delivery, login, recovery, searches, feedback, and
  anonymous uploads must have server-side abuse controls and rate limits.
- CAPTCHA decisions must be verified by a trusted server and must not replace
  authorization, rate limiting, or replay protection.
- Password and email changes must require a purpose-bound, verified challenge
  and must not trust a user ID, email, or success flag controlled by the client.

### Payments, fines, wallets, and refunds

- The server is authoritative for prices, fees, tax, currency, discounts,
  payable items, balances, eligibility, and payment status.
- Client-supplied amounts, fine references, application IDs, transaction
  numbers, receipt IDs, or success routes must never determine financial state
  without server verification.
- Purchase, cancellation, refund, recharge, wallet PIN, and receipt operations
  must be authorized, replay-safe, and idempotent where retries can occur.
- Payment callbacks and polling results must be bound to the initiating user or
  public payment session and the exact purchased items.
- Payment-page URLs must be validated against an explicit provider allowlist
  and opened without granting an untrusted page control of the portal window.

### Untrusted content, schemas, and URLs

- API, CMS, Formily, localization, query-string, error, and SignalR data must be
  treated as untrusted even when returned by a UMC-controlled service.
- Untrusted HTML must not reach `dangerouslySetInnerHTML`, `innerHTML`, or an
  equivalent sink without a maintained allowlist-based HTML sanitizer.
  Escaping quotes or applying regular expressions is not sanitization.
- Sanitization must reject scripts, event handlers, unsafe URL schemes,
  dangerous SVG/MathML content, active embeds, and other browser-executable
  content.
- Dynamic Formily schemas and form values must be bounded, parsed safely, and
  prevented from selecting arbitrary executable components, injecting
  functions, or modifying object prototypes.
- Backend-provided navigation, media, preview, download, logout, payment, and
  SignalR URLs must use explicit scheme and origin allowlists.
- Sensitive request and response bodies, credentials, tokens, OTPs, identity
  data, and documents must not be written to production logs or consoles.

### Uploads, documents, downloads, and OCR

- Client-side extension, MIME, and size checks are usability controls only.
  Uploaded files must be validated server-side by content, type, size, and
  structure and should be scanned for malicious content.
- Public uploads require stricter quotas and must not create anonymously
  readable or executable objects.
- Uploaded HTML, SVG, script, or other active content must not execute in the
  trusted portal origin. Downloads should use safe content types and
  `Content-Disposition` where appropriate.
- Document names, paths, object keys, IDs, and URLs must be authorized and
  normalized server-side to prevent traversal, SSRF, arbitrary-file access,
  and cross-profile disclosure.
- OCR output is untrusted derived input. It must not override verified identity
  data or bypass validation and authorization.
- PDF, image, spreadsheet, JSON, and schema parsing must have resource limits
  and must fail safely on malformed or oversized input.

### Real-time messaging

- SignalR connections must authenticate the current session and active profile.
- Subscriptions and messages must be scoped server-side so one profile cannot
  receive another profile's notifications.
- Connection identifiers, event names, and client-supplied invocation arguments
  are not authorization credentials.
- Notification payloads must be handled as untrusted content and must not cause
  navigation or HTML execution without validation.

### Secrets, configuration, and supply chain

- Secrets must not be committed, placed in `VITE_*` variables, shipped in
  static assets, or included in source maps. Public API keys must be restricted
  by origin, API, quota, and environment.
- Runtime configuration may select only approved HTTPS service origins.
- Production dependencies, patches, install scripts, and build plugins are part
  of the trusted computing base. A reachable dependency compromise that can
  alter production code or steal protected data is reportable.
- Test and mock files must not contain real credentials, tokens, identity
  documents, or unnecessary real personal data.

## Reportable Findings and Severity Context

A finding is reportable when it demonstrates a plausible, reachable violation
of a security invariant in this repository or its integration contract. State
uncertain backend assumptions explicitly; do not claim that an unseen backend
control is absent.

Report findings involving:

- Authentication, OTP, recovery, UAE PASS, account merge, global view, or
  impersonation bypass.
- Cross-account, cross-profile, or cross-establishment data access or mutation.
- XSS or unsafe content execution, especially where Web Storage tokens or
  identity data are exposed.
- Token, credential, OTP, personal-data, document, or payment-data leakage.
- Unauthorized payment, wallet, refund, fine, fee, receipt, or status changes.
- Open redirects or attacker-controlled external navigation that enable token
  theft, phishing, or payment diversion.
- Public endpoint enumeration or unauthenticated access to non-public records.
- Unsafe upload, download, preview, OCR, dynamic-schema, or SignalR behavior.
- Secrets or real sensitive personal data committed to the repository.
- Build or dependency weaknesses with a demonstrated path into production.

Severity should reflect realistic reachability and impact:

- **Critical:** systemic authentication or impersonation compromise, arbitrary
  privileged/global access, broad payment diversion, or a production
  supply-chain compromise affecting many users.
- **High:** account takeover, exploitable XSS in the trusted origin, UAE PASS or
  recovery bypass, cross-profile sensitive-data exposure, unauthorized
  financial actions, or executable malicious uploads.
- **Medium:** bounded enumeration, limited sensitive-data exposure, or a
  security-control weakness requiring significant additional conditions.
- **Low:** minor information exposure or hardening issues with no demonstrated
  path to protected assets.

The presence of Web Storage tokens, raw HTML rendering, public file flows,
callback query parameters, or client-supplied financial and identity fields
must be investigated. Their current presence does not constitute accepted risk.

## Out of Scope, Exclusions, and Accepted Risk

No security risks or finding classes are currently owner-approved as accepted
risk.

The following are not reportable by themselves:

- Speculation about backend, gateway, cloud, identity-provider, or payment
  implementation with no evidence in this repository or reachable contract.
- The absence of server-side rate limiting, authorization, malware scanning, or
  security headers from frontend source alone. Record these as unverified
  assumptions unless repository evidence demonstrates an exploitable failure.
- Development-only Vite proxies, mock plugins, or fixtures that cannot enter or
  affect production. Secrets and real personal data in those files remain in
  scope.
- A bypass of client-only field validation with no security impact and no
  evidence that a protected backend operation accepts the invalid value.
- Dependency version findings without a reachable affected code path or
  meaningful production impact.
- Purely cosmetic, accessibility, localization, or availability issues that do
  not affect a security property.

Do not use these exclusions to suppress a concrete data flow from attacker
input to a sensitive sink or operation.

## Known Limitations and Compensating Controls

- Backend, gateway, deployment, storage, and infrastructure source are not
  available here, so their controls must be marked as unverified.
- Production CSP, framing policy, HSTS, CORS, cache policy, and other HTTP
  headers are not established by this repository.
- The application currently stores authentication and pre-authentication state
  in browser storage. This is a limitation that increases XSS impact, not a
  compensating control or accepted risk.
- The application contains backend-supplied HTML and dynamic schema rendering.
  Each source-to-sink path requires validation; trust in the supplying service
  alone is not sufficient.
- Client route guards, form validation, OTP countdowns, UI lock states, and the
  idle timer improve user experience but do not prove server enforcement.
- Production exposure of every explicitly public route, including the
  impersonation entry route, is assumed until deployment owners confirm
  otherwise.
