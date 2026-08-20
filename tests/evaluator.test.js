import test from "node:test";
import assert from "node:assert/strict";
import { aggregateSessions, evaluateAnswer } from "../src/evaluator.js";

test("complete reasoned answer scores above a shallow answer", () => {
  const strong = evaluateAnswer({ choiceCorrect: true, text: "sum 没有初始化，因此会读取垃圾值并产生未定义行为；i < n 会遗漏 5，应改为 i <= n。", reflection: "如果 n=0，初始化和边界是否仍然正确？", keywords: ["初始化","sum","未定义","<","<=","边界","5"] });
  const shallow = evaluateAnswer({ choiceCorrect: false, text: "代码错了", reflection: "", keywords: ["初始化","sum","未定义","<","<=","边界","5"] });
  assert.ok(strong.overall > shallow.overall);
  assert.ok(strong.dimensions.inquiry >= 80);
});

test("scores stay within a valid 0-100 range", () => {
  const result = evaluateAnswer({ choiceCorrect: true, text: "因为应该修改，所以这是原因。".repeat(30), reflection: "为什么？".repeat(30), keywords: ["因为","修改","原因"] });
  assert.ok(Object.values(result.dimensions).every((value) => value >= 0 && value <= 100));
});

test("session aggregation returns rounded averages", () => {
  const result = aggregateSessions([{ result:{overall:70,dimensions:{correctness:60,clarity:70,depth:80,inquiry:90}} },{ result:{overall:80,dimensions:{correctness:80,clarity:90,depth:60,inquiry:70}} }]);
  assert.equal(result.overall,75);
  assert.deepEqual(result.averages,{correctness:70,clarity:80,depth:70,inquiry:80});
});
