import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
const source = fs.readFileSync(new URL(
  "../src/components/designable/src/components/EquipmentList/EquipmentList.tsx",
  import.meta.url,
), "utf8");
const translate = (key) => key;
const form = {};
const textMap = {};
const sameDeps = (a, b) =>
  a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
const stub = () => null;
stub.useForm = () => [form];
stub.Item = stub;
stub.Option = stub;
const antd = new Proxy({}, { get: () => stub });
const equipment = [{ equipmentId: "camera", number: 2 }];
const fieldSource = {
  fields: [{ fieldName: "Number", displayType: "Input" }],
};
const cases = [
  { name: "empty runtime", props: {} },
  { name: "empty designer", props: { designMode: true } },
  { name: "configured designer", props: { designMode: true, fieldSource } },
  { name: "controlled runtime", props: { value: equipment } },
];
function mount(code, initialProps) {
  let cursor = 0;
  let pending = false;
  let effects = [];
  let props = initialProps;
  const slots = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next) => {
        const value = typeof next === "function" ? next(slots[index]) : next;
        if (!Object.is(slots[index], value)) {
          slots[index] = value;
          pending = true;
        }
      }];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) {
        slots[index] = { deps, value: factory() };
      }
      return slots[index].value;
    },
    useCallback(callback, deps) {
      return react.useMemo(() => callback, deps);
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index], deps)) {
        slots[index] = deps;
        effects.push(effect);
      }
    },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText, {
    exports,
    console,
    require(name) {
      if (name === "react") return react;
      if (name === "antd") return antd;
      if (name === "react-i18next") return { useTranslation: () => ({ t: translate }) };
      if (name === "./i18n") return { createEquipmentListTextMap: () => textMap };
      if (name.endsWith("/EmptyBox")) return { default: stub };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return {
    async settle(nextProps = props) {
      props = nextProps;
      for (let renders = 1; renders <= 20; renders++) {
        cursor = 0;
        effects = [];
        pending = false;
        exports.default(props);
        effects.forEach((effect) => effect());
        await Promise.resolve();
        if (!pending) return { renders, data: slots[0] };
      }
      throw new Error("Render loop exceeded 20 renders");
    },
  };
}
for (const { name, props } of cases) {
  test(`${name} settles without repeated state updates`, async () => {
    const result = await mount(source, props).settle();
    assert.ok(result.renders <= 3);
    if (props.value) assert.equal(result.data, equipment);
    else if (props.designMode) assert.equal(result.data.length, 1);
    else assert.equal(result.data.length, 0);
  });
}
test("controlled value changes still synchronize", async () => {
  const component = mount(source, {});
  await component.settle();
  assert.equal((await component.settle({ value: equipment })).data, equipment);
  assert.equal((await component.settle({})).data.length, 0);
});
test("original fresh-array default reproduces the loop", async () => {
  const original = source.replace("value = EMPTY_EQUIPMENT_ITEMS", "value = []");
  assert.notEqual(original, source);
  for (const { props } of cases.slice(0, 3)) {
    await assert.rejects(mount(original, props).settle(), /Render loop/);
  }
});
