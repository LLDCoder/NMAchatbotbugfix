import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
const {outputFiles} = await build({entryPoints:[new URL("../src/utils/internationalText.ts",import.meta.url).pathname],bundle:true,platform:"node",format:"esm",write:false});
const {isInternationalName,isInternationalText,trimInternationalText,codePointLength}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
test("international names and generic text have different content requirements",()=>{
 for(const value of ["مــوزه المــرر","José O’Connor","John Smith","𐐀𐐁","مُوزة","A1🙂","A\u200dB"]) assert.equal(isInternationalName(value),true,value);
 for(const value of ["123","!!!","ــ","ُّ","🙂🙂"]){assert.equal(isInternationalText(value),true);assert.equal(isInternationalName(value),false);}
});
test("original control characters cannot disappear through normalization",()=>{
 for(const value of ["AB\n","\tAB","\ufeffAB","A\u202eB","A\ue000","A\ud800","A\u0378"]){assert.equal(isInternationalText(value),false);assert.equal(trimInternationalText(value),value);}
 assert.equal(trimInternationalText("\u00a0 A  B \u00a0"),"A  B");
});
test("Unicode length and trimming never silently truncate",()=>{
 for(const max of [50,100,200,300,512]){
  assert.equal(codePointLength("𐐀".repeat(max)),max);
  assert.equal(codePointLength("𐐀".repeat(max+1)),max+1);
  assert.equal(trimInternationalText("𐐀".repeat(max+1)),"𐐀".repeat(max+1));
 }
});
