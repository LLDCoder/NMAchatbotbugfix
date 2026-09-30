import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const loadTypeScriptModule = async (relativePath) => {
  const sourcePath = new URL(relativePath, import.meta.url);
  const source = await readFile(sourcePath, "utf8");
  const { code } = await transformWithEsbuild(source, sourcePath.pathname, {
    loader: "ts",
    format: "esm",
    target: "node20",
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString(
    "base64",
  )}`;
  return import(moduleUrl);
};

const {
  buildApplicationDeliveryDisplay,
  resolveActiveTaskDeliveryInformation,
  resolveApplicationDeliveryInformation,
} = await loadTypeScriptModule(
  "../src/pages/ApplicationsDetails/DeliveryInformation/viewModel.ts",
);

const deliveryInfo = {
  id: 43,
  applicationId: 2758,
  applicationDetailId: 2758,
  courierId: 1,
  courierNameEn: "Emirates Post",
  courierNameAr: "Emirates Post",
  recipientName: "ren_1801",
  addressEn: "Street-1 - AL CORNICHE - Dubai - United Arab Emirates",
  addressAr: "Street-1 - الكورنيش - دبي - الإمارات العربية المتحدة",
  mobile: "+8617310812960",
};

test("reads deliveryInfo from MyReviewDetail", () => {
  assert.deepEqual(
    resolveApplicationDeliveryInformation({ deliveryInfo }),
    deliveryInfo,
  );
});

test("hides delivery information when MyReviewDetail returns null", () => {
  assert.equal(
    resolveApplicationDeliveryInformation({ deliveryInfo: null }),
    null,
  );
});

test("does not show delivery information from a previous task", () => {
  assert.equal(
    resolveActiveTaskDeliveryInformation(
      { taskId: "task-with-delivery", data: deliveryInfo },
      "task-without-delivery",
    ),
    null,
  );
});

test("uses backend-composed English delivery values", () => {
  assert.deepEqual(buildApplicationDeliveryDisplay(deliveryInfo, false), {
    courierService: "Emirates Post",
    recipientName: "ren_1801",
    mobileNumber: "+8617310812960",
    address: "Street-1 - AL CORNICHE - Dubai - United Arab Emirates",
  });
});

test("uses backend-composed Arabic delivery values", () => {
  assert.deepEqual(buildApplicationDeliveryDisplay(deliveryInfo, true), {
    courierService: "Emirates Post",
    recipientName: "ren_1801",
    mobileNumber: "+8617310812960",
    address: "Street-1 - الكورنيش - دبي - الإمارات العربية المتحدة",
  });
});
