const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function evaluateAnswer({ text = "", reflection = "", choiceCorrect = false, keywords = [] }) {
  const normalized = `${text} ${reflection}`.toLowerCase();
  const hits = keywords.filter((word) => normalized.includes(word.toLowerCase()));
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
  if (!sessions.length) return { averages: { correctness: 0, clarity: 0, depth: 0, inquiry: 0 }, overall: 0 };
  const keys = ["correctness", "clarity", "depth", "inquiry"];
  const averages = Object.fromEntries(keys.map((key) => [key, Math.round(sessions.reduce((sum, item) => sum + (item.result?.dimensions?.[key] || 0), 0) / sessions.length)]));
  const overall = Math.round(sessions.reduce((sum, item) => sum + (item.result?.overall || 0), 0) / sessions.length);
  return { averages, overall };
}
