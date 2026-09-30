import { readFileSync, existsSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { constants, createHash, publicEncrypt } from "node:crypto";

function getEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(name) {
  return process.env[name]?.trim() || "";
}

function normalizeBaseUrl(input) {
  return input.replace(/\/+$/, "");
}

function md5(value) {
  return createHash("md5").update(value).digest("hex");
}

function createSignedToken(secret, requestTime) {
  return md5(`${requestTime}${md5(secret)}`);
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#10;/g, "\n")
    .replace(/&#13;/g, "\r");
}

function extractDataAttribute(html, className) {
  const pattern = new RegExp(
    `<div[^>]*class="${className}"[^>]*data="([^"]+)"`,
    "i",
  );
  const match = html.match(pattern);
  if (!match) {
    throw new Error(`Could not find ${className} in login page`);
  }
  return decodeHtmlEntities(match[1]);
}

function extractRequestToken(html) {
  const match = html.match(
    /id="request_token_head"[^>]*token="([^"]+)"/i,
  );
  if (!match) {
    throw new Error("Could not find x-http-token in panel HTML");
  }
  return decodeHtmlEntities(match[1]);
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function rsaEncrypt(text, publicKey) {
  const encrypted = publicEncrypt(
    {
      key: publicKey,
      padding: constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(text, "utf8"),
  );
  return encrypted.toString("base64");
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  addFromResponse(response) {
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];

    for (const rawCookie of setCookies) {
      const [pair] = rawCookie.split(";", 1);
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (!key) continue;
      this.cookies.set(key, value);
    }
  }

  toHeader() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
}

function applyApiSignature(url, apiSecret) {
  if (!apiSecret) {
    return url;
  }

  const requestTime = Date.now().toString();
  const requestToken = createSignedToken(apiSecret, requestTime);
  const signedUrl = new URL(url);
  signedUrl.searchParams.set("request_time", requestTime);
  signedUrl.searchParams.set("request_token", requestToken);
  return signedUrl.toString();
}

async function request(url, { auth, jar, headers = {}, ...options } = {}) {
  const finalHeaders = new Headers(headers);
  const cookieHeader = jar?.toHeader();
  if (cookieHeader) {
    finalHeaders.set("cookie", cookieHeader);
  }

  const response = await fetch(applyApiSignature(url, auth?.apiSecret), {
    redirect: "manual",
    ...options,
    headers: finalHeaders,
  });

  jar?.addFromResponse(response);
  return response;
}

async function fetchText(url, options) {
  const response = await request(url, options);
  const body = await response.text();
  return { response, body };
}

async function ensureOkJson(url, options, actionLabel) {
  const response = await request(url, options);
  const bodyText = await response.text();

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new Error(`${actionLabel} returned non-JSON: ${bodyText.slice(0, 500)}`);
  }

  const isSuccess =
    payload === true ||
    payload?.status === true ||
    payload?.status === 1 ||
    payload?.msg === "LOGIN_SUCCESS";

  if (!isSuccess) {
    throw new Error(
      `${actionLabel} failed: ${payload?.msg || payload?.message || bodyText}`,
    );
  }

  return payload;
}

async function getDashboardHtml(baseUrl, jar) {
  const rootUrl = `${baseUrl}/`;
  let { response, body } = await fetchText(rootUrl, { jar });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) {
      throw new Error("Panel redirected without a Location header");
    }
    const redirectUrl = new URL(location, rootUrl).toString();
    ({ response, body } = await fetchText(redirectUrl, { jar }));
  }

  if (!response.ok) {
    throw new Error(`Failed to load panel dashboard: HTTP ${response.status}`);
  }

  return body;
}

async function getApiRequestToken(baseUrl, jar, auth) {
  const { response, body } = await fetchText(`${baseUrl}/config?action=get_token`, {
    auth,
    jar,
  });

  if (!response.ok) {
    throw new Error(`Failed to initialize panel API: HTTP ${response.status}`);
  }

  const payload = tryParseJson(body);
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (typeof payload?.token === "string" && payload.token.trim()) {
    return payload.token.trim();
  }

  if (typeof payload?.data === "string" && payload.data.trim()) {
    return payload.data.trim();
  }

  if (typeof body === "string" && body.trim() && !body.trim().startsWith("{")) {
    return body.trim();
  }

  return "";
}

function getArchiveType(filePath) {
  if (filePath.endsWith(".tar.gz") || filePath.endsWith(".tgz")) {
    return "tar";
  }
  if (extname(filePath) === ".zip") {
    return "zip";
  }
  throw new Error("Unsupported archive format. Use .tar.gz, .tgz, or .zip");
}

async function deletePathIfExists(baseUrl, jar, auth, requestToken, path, isDirectory) {
  const endpoint = isDirectory
    ? `${baseUrl}/files?action=DeleteDir`
    : `${baseUrl}/files?action=DeleteFile`;

  const form = new URLSearchParams();
  form.set("path", path);

  const response = await request(endpoint, {
    auth,
    jar,
    method: "POST",
    headers: requestToken
      ? {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-http-token": requestToken,
        }
      : {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
    body: form,
  });

  const bodyText = await response.text();
  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new Error(`Delete request failed: ${bodyText.slice(0, 500)}`);
  }

  const msg = String(payload?.msg || "");
  const missing =
    msg.includes("does not exist") ||
    msg.includes("not exist") ||
    msg.includes("not exist") ||
    msg.includes("Configuration file not exist");

  if (payload?.status === true || payload?.status === 1 || missing) {
    return;
  }

  throw new Error(`Delete ${path} failed: ${msg || bodyText}`);
}

async function uploadArchive(baseUrl, jar, auth, requestToken, deployPath, archivePath, remoteName) {
  const fileBuffer = readFileSync(archivePath);
  const file = new File([fileBuffer], remoteName);
  const form = new FormData();
  form.set("f_name", remoteName);
  form.set("f_path", deployPath);
  form.set("f_size", String(fileBuffer.byteLength));
  form.set("f_start", "0");
  form.append("blob", file);

  const response = await request(`${baseUrl}/files?action=upload`, {
    auth,
    jar,
    method: "POST",
    headers: requestToken
      ? {
          "x-http-token": requestToken,
        }
      : {},
    body: form,
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(`Upload failed: HTTP ${response.status} ${bodyText.slice(0, 500)}`);
  }

  if (bodyText.includes("INIT_CSRF_ERR")) {
    throw new Error("Upload failed: CSRF token rejected");
  }

  if (bodyText.includes("Wrong parameter") || bodyText.includes("Failed")) {
    throw new Error(`Upload failed: ${bodyText}`);
  }
}

async function unzipArchive(baseUrl, jar, auth, requestToken, sourceFile, targetDir, archiveType) {
  const form = new URLSearchParams();
  form.set("sfile", sourceFile);
  form.set("dfile", targetDir);
  form.set("type", archiveType);
  form.set("coding", "UTF-8");
  form.set("password", "");

  await ensureOkJson(
    `${baseUrl}/files?action=UnZip`,
    {
      auth,
      jar,
      method: "POST",
      headers: requestToken
        ? {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-http-token": requestToken,
          }
        : {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          },
      body: form,
    },
    "Unzip archive",
  );
}

async function login(baseUrl, jar, username, password) {
  const { response, body } = await fetchText(`${baseUrl}/login`, { jar });
  if (!response.ok) {
    throw new Error(
      `Failed to open login page at ${baseUrl}/login: HTTP ${response.status}`,
    );
  }

  const lastToken = extractDataAttribute(body, "last_token");
  const publicKey = extractDataAttribute(body, "public_key");

  const usernameHash = md5(md5(`${username}${lastToken}`));
  const passwordHash = md5(`${md5(password)}_bt.cn`);

  const form = new URLSearchParams();
  form.set("username", rsaEncrypt(usernameHash, publicKey));
  form.set("password", rsaEncrypt(passwordHash, publicKey));

  const loginResponse = await request(`${baseUrl}/login`, {
    jar,
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: form,
  });

  const loginText = await loginResponse.text();
  let payload;
  try {
    payload = JSON.parse(loginText);
  } catch {
    throw new Error(`Login failed with unexpected response: ${loginText.slice(0, 500)}`);
  }

  if (payload?.status !== true && payload?.msg !== "LOGIN_SUCCESS") {
    throw new Error(`Login failed: ${payload?.msg || loginText}`);
  }
}

function resolveAuth() {
  const apiSecret = getOptionalEnv("BT_PANEL_API_SECRET");
  if (apiSecret) {
    return { apiSecret, mode: "api-secret" };
  }

  return {
    mode: "password",
    username: getEnv("BT_PANEL_USERNAME"),
    password: getEnv("BT_PANEL_PASSWORD"),
  };
}

async function main() {
  const archiveArg = process.argv[2];
  if (!archiveArg || archiveArg === "--help") {
    console.log("Usage: npm run deploy:bt -- <archive-path>");
    process.exit(0);
  }

  const archivePath = resolve(archiveArg);
  if (!existsSync(archivePath) || !statSync(archivePath).isFile()) {
    throw new Error(`Archive not found: ${archivePath}`);
  }

  const baseUrl = normalizeBaseUrl(getEnv("BT_PANEL_URL"));
  const auth = resolveAuth();
  const deployPath = getEnv("BT_DEPLOY_PATH");

  const archiveType = getArchiveType(archivePath);
  const remoteName = basename(archivePath);
  const remoteArchivePath = `${deployPath}/${remoteName}`;
  const remoteDistPath = `${deployPath}/dist`;

  const jar = new CookieJar();

  console.log(`Deploying ${remoteName} to ${deployPath} via ${auth.mode}`);

  let requestToken = "";
  if (auth.mode === "api-secret") {
    requestToken = await getApiRequestToken(baseUrl, jar, auth);
  } else {
    await login(baseUrl, jar, auth.username, auth.password);
    const dashboardHtml = await getDashboardHtml(baseUrl, jar);
    requestToken = extractRequestToken(dashboardHtml);
  }

  await deletePathIfExists(baseUrl, jar, auth, requestToken, remoteDistPath, true);
  await deletePathIfExists(baseUrl, jar, auth, requestToken, remoteArchivePath, false);
  await uploadArchive(baseUrl, jar, auth, requestToken, deployPath, archivePath, remoteName);
  await unzipArchive(
    baseUrl,
    jar,
    auth,
    requestToken,
    remoteArchivePath,
    deployPath,
    archiveType,
  );
  await deletePathIfExists(baseUrl, jar, auth, requestToken, remoteArchivePath, false);

  console.log("Deploy finished successfully");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
