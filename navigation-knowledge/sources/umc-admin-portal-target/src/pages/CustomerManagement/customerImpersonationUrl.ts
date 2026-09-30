export const createCustomerImpersonationUrlBuilder = (
  configuredPortalUrl: string,
) => {
  const targetUrl = new URL("/impersonation", configuredPortalUrl);

  return (code: string) => {
    targetUrl.searchParams.set("code", code);
    return targetUrl.toString();
  };
};
