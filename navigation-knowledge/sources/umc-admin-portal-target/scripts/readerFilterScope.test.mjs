import test from "node:test";
import assert from "node:assert/strict";
import moment from "moment";
import { appliedFilterSignature, readerFilterScope } from "../src/components/common/FilterTable/readerScope.ts";

test("committed free text changes local scope without disclosing text or credentials", () => {
  const a={keyword:"person@example.test",accessToken:"secret",status:"Pending"};
  const b={...a,keyword:"another@example.test"};
  assert.notEqual(appliedFilterSignature(a),appliedFilterSignature(b));
  const context=readerFilterScope("table-1",2,a,[{type:"input",key:"keyword"},{type:"select",key:"accessToken"},{type:"select",key:"status"}]);
  assert.deepEqual(JSON.parse(context),{contextVersion:"table-1:2",filters:{status:"Pending"}});
  assert.ok(!context.includes("person")&&!context.includes("secret"));
});

test("calendar ranges keep selected calendar date and offset", () => {
  const selected=moment.parseZone("2026-09-23T00:00:00+04:00");
  const scope=JSON.parse(readerFilterScope("table-2",1,{period:[selected,selected]},[{type:"range",key:"period"}]));
  assert.deepEqual(scope.filters.period,["2026-09-23T00:00:00+04:00","2026-09-23T00:00:00+04:00"]);
});

test("bounded metadata does not serialize custom objects, long labels or oversized lists", () => {
  let invoked=false;
  const scope=readerFilterScope("table-3",9,{custom:{toJSON(){invoked=true;return "private";}},long:"x".repeat(1000),members:Array(50).fill(123),status:"Pending"},
    ["custom","long","members","status"].map(key=>({type:"select",key})));
  assert.equal(invoked,false);assert.ok(scope.length<=480);
  assert.deepEqual(JSON.parse(scope).filters,{status:"Pending"});
});
