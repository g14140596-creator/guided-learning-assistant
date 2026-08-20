import test from "node:test";
import assert from "node:assert/strict";
import { aggregateSessions, deriveLearningSignals, evaluateAnswer } from "../src/evaluator.js";

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
  const result = aggregateSessions([{ durationSeconds:120, attempts:1, result:{overall:70,dimensions:{correctness:60,clarity:70,depth:80,inquiry:90}} },{ durationSeconds:180, attempts:2, result:{overall:80,dimensions:{correctness:80,clarity:90,depth:60,inquiry:70}} }]);
  assert.equal(result.overall,75);
  assert.deepEqual(result.averages,{correctness:70,clarity:80,depth:70,inquiry:80});
  assert.equal(result.totalMinutes, 5);
  assert.equal(result.averageAttempts, 1.5);
});

test("learning signals expose confidence mismatch and hint dependence", () => {
  const sessions = [
    { choiceCorrect:false, confidence:5, hintsUsed:2, result:{overall:55,dimensions:{correctness:40,clarity:65,depth:55,inquiry:60}} },
    { choiceCorrect:true, confidence:2, hintsUsed:0, result:{overall:78,dimensions:{correctness:85,clarity:75,depth:74,inquiry:70}} }
  ];
  const signals = deriveLearningSignals(sessions);
  assert.ok(signals.some((item) => item.title.includes("高置信度误判")));
  assert.ok(signals.some((item) => item.title.includes("正确但尚不自信")));
  assert.ok(signals.some((item) => item.title.includes("提示依赖")));
});

test("keyword matching uses word boundaries, not substring matching", () => {
  // "15" 不得命中关键词 "5"；"assume" 不得命中 "sum"；中文关键词仍应命中
  const result = evaluateAnswer({ choiceCorrect: true, text: "结果是 15，assume 变量名没问题，循环边界处理正确。", reflection: "如果 n=0 呢？", keywords: ["5", "sum", "边界"] });
  assert.ok(!result.matchedKeywords.includes("5"), "15 must not match keyword 5");
  assert.ok(!result.matchedKeywords.includes("sum"), "assume must not match keyword sum");
  assert.ok(result.matchedKeywords.includes("边界"), "Chinese keyword should still match");
});

test("standalone numeric and English keywords still match", () => {
  const result = evaluateAnswer({ choiceCorrect: true, text: "i 遗漏了 5，sum 没有初始化。", reflection: "", keywords: ["5", "sum", "初始化"] });
  assert.ok(result.matchedKeywords.includes("5"));
  assert.ok(result.matchedKeywords.includes("sum"));
  assert.ok(result.matchedKeywords.includes("初始化"));
});
