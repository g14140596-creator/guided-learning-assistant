const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

// 关键词匹配：纯字母数字关键词（如 "5"、"sum"）使用词边界 \b，避免子串误匹配
// （"15" 误命中 "5"、"assume" 误命中 "sum"）；中文与含符号的关键词保持包含匹配，
// 因为教学关键词如 "初始化"、"<=" 按包含关系判断更符合直觉。
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matchesKeyword = (text, keyword) => {
  const kw = keyword.toLowerCase();
  if (/^[a-z0-9_.]+$/.test(kw)) {
    return new RegExp(`\\b${escapeRegExp(kw)}\\b`).test(text);
  }
  return text.includes(kw);
};

export function evaluateAnswer({ text = "", reflection = "", choiceCorrect = false, keywords = [] }) {
  const normalized = `${text} ${reflection}`.toLowerCase();
  const hits = keywords.filter((word) => matchesKeyword(normalized, word));
  const uniqueHits = new Set(hits).size;
  const sentences = text.split(/[。！？.!?;；]/).filter((item) => item.trim().length > 3).length;
  const hasReasoning = /(因为|因此|所以|导致|意味着|会使|原因|because|therefore)/i.test(normalized);
  const hasFix = /(改为|修改|应该|修复|使用|写成|return|<=|==|i <)/i.test(normalized);
  const hasQuestion = /[?？]|为什么|是否|如果/.test(reflection);

  const correctness = clamp((choiceCorrect ? 35 : 10) + uniqueHits * 8 + (hasFix ? 15 : 0));
  const clarity = clamp(30 + Math.min(text.length, 100) * 0.35 + sentences * 8);
  const depth = clamp(18 + uniqueHits * 7 + (hasReasoning ? 25 : 0) + (sentences >= 2 ? 12 : 0));
  const inquiry = clamp(20 + (reflection.length > 8 ? 35 : 0) + (hasQuestion ? 30 : 0));
  const overall = Math.round(correctness * 0.4 + clarity * 0.2 + depth * 0.25 + inquiry * 0.15);

  const strengths = [];
  const next = [];
  if (choiceCorrect) strengths.push("输出预测正确，说明你能追踪基本执行过程");
  if (uniqueHits >= 3) strengths.push("识别到了多个关键概念");
  if (hasReasoning) strengths.push("不仅指出现象，也尝试解释原因");
  if (!choiceCorrect) next.push("重新逐行手算变量变化，再判断输出");
  if (uniqueHits < 3) next.push("明确写出出错位置、后果和修改方案");
  if (!hasReasoning) next.push("补充“为什么会这样”，而不只写正确答案");
  if (!hasQuestion) next.push("提出一个边界情况或反例问题，检验自己的理解");

  return {
    overall,
    dimensions: { correctness: Math.round(correctness), clarity: Math.round(clarity), depth: Math.round(depth), inquiry: Math.round(inquiry) },
    strengths: strengths.length ? strengths : ["已完成作答并留下了可继续分析的思路"],
    next: next.length ? next : ["尝试为同一错误设计一个更隐蔽的测试用例"],
    matchedKeywords: [...new Set(hits)]
  };
}

export function aggregateSessions(sessions = []) {
  if (!sessions.length) return { averages: { correctness: 0, clarity: 0, depth: 0, inquiry: 0 }, overall: 0, totalMinutes: 0, averageAttempts: 0 };
  const keys = ["correctness", "clarity", "depth", "inquiry"];
  const averages = Object.fromEntries(keys.map((key) => [key, Math.round(sessions.reduce((sum, item) => sum + (item.result?.dimensions?.[key] || 0), 0) / sessions.length)]));
  const overall = Math.round(sessions.reduce((sum, item) => sum + (item.result?.overall || 0), 0) / sessions.length);
  const totalMinutes = Math.max(1, Math.round(sessions.reduce((sum, item) => sum + (item.durationSeconds || 0), 0) / 60));
  const averageAttempts = Number((sessions.reduce((sum, item) => sum + (item.attempts || 1), 0) / sessions.length).toFixed(1));
  return { averages, overall, totalMinutes, averageAttempts };
}

export function deriveLearningSignals(sessions = []) {
  if (!sessions.length) return [];
  const summary = aggregateSessions(sessions);
  const labels = { correctness: "正确性", clarity: "表达规范", depth: "分析深度", inquiry: "反问质量" };
  const [weakestKey, weakestValue] = Object.entries(summary.averages).sort((a, b) => a[1] - b[1])[0];
  const lowConfidenceCorrect = sessions.filter((item) => item.choiceCorrect && Number(item.confidence || 3) <= 2).length;
  const highConfidenceIncorrect = sessions.filter((item) => !item.choiceCorrect && Number(item.confidence || 3) >= 4).length;
  const hintHeavy = sessions.filter((item) => Number(item.hintsUsed || 0) >= 2).length;
  const signals = [{ level: "focus", title: `优先提升：${labels[weakestKey]}`, detail: `当前均值 ${weakestValue}。下一次练习应围绕这一能力增加一次针对性追问。` }];
  if (highConfidenceIncorrect) signals.push({ level: "risk", title: "存在高置信度误判", detail: `${highConfidenceIncorrect} 个单元中，学生非常确定但预测错误，建议先修正概念模型。` });
  if (lowConfidenceCorrect) signals.push({ level: "growth", title: "正确但尚不自信", detail: `${lowConfidenceCorrect} 个单元预测正确但置信度较低，可通过口头解释巩固。` });
  if (hintHeavy) signals.push({ level: "focus", title: "对提示依赖较高", detail: `${hintHeavy} 个单元使用了两级以上提示，建议安排相似题做无提示迁移。` });
  if (signals.length === 1) signals.push({ level: "growth", title: "具备迁移学习条件", detail: "当前未发现明显风险信号，可让学生自己设计一个错误示例。" });
  return signals;
}
