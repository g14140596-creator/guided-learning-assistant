import { lessons } from "./content.js";
import { aggregateSessions, evaluateAnswer } from "./evaluator.js";

const $ = (selector) => document.querySelector(selector);
const storageKey = "xunma-learning-sessions-v1";
const state = { lessonIndex: 0, step: 0, answers: {}, sessions: loadSessions() };

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(storageKey)) || []; } catch { return []; }
}
function saveSessions() { localStorage.setItem(storageKey, JSON.stringify(state.sessions)); }
function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2200); }

function renderLessonList() {
  $("#lessonList").innerHTML = lessons.map((lesson, index) => `<button class="lesson-button ${index === state.lessonIndex ? "active" : ""}" data-lesson="${index}"><span class="lesson-index">0${index + 1}</span><span class="lesson-copy"><strong>${lesson.title}</strong><small>${lesson.level}</small></span><span class="lesson-state">${state.sessions.some((item) => item.lessonId === lesson.id) ? "✓" : "→"}</span></button>`).join("");
  document.querySelectorAll("[data-lesson]").forEach((button) => button.addEventListener("click", () => { state.lessonIndex = Number(button.dataset.lesson); state.step = 0; render(); }));
}

function conceptTemplate(lesson) {
  return `<h3>${lesson.concept.title}</h3><p class="lead">${lesson.concept.lead}</p><div class="concept-grid">${lesson.concept.cards.map(([n,t,p]) => `<article class="concept"><span>${n}</span><strong>${t}</strong><p>${p}</p></article>`).join("")}</div><div class="checkpoint"><span>✦</span><div><strong>停一下，先在脑中回答</strong><br>${lesson.concept.checkpoint}</div></div>`;
}
function codeTemplate(lesson) {
  const answer = state.answers[lesson.id] || {};
  return `<h3>先预测，再验证</h3><p class="lead">阅读代码时，不要凭感觉。用纸笔记录关键变量每一轮的变化。</p><div class="code-card"><div class="code-toolbar"><i></i><i></i><i></i><span>main.cpp</span><em>规范示例</em></div><pre><code>${escapeHtml(lesson.code)}</code></pre></div><span class="question-label">理解检查 · 单选</span><p><strong>${lesson.prediction.question}</strong></p><div class="choice-list">${lesson.prediction.choices.map((choice,index)=>`<label class="choice ${answer.choice === index ? "selected" : ""}"><input type="radio" name="prediction" value="${index}" ${answer.choice === index ? "checked" : ""}>${choice}</label>`).join("")}</div>`;
}
function challengeTemplate(lesson) {
  const answer = state.answers[lesson.id] || {};
  return `<h3>这段代码“能编译”就一定正确吗？</h3><p class="lead">下面是助教故意加入问题的版本。请像代码审查者一样，定位问题并解释后果。</p><div class="code-card"><div class="code-toolbar"><i></i><i></i><i></i><span>challenge.cpp</span><em>含潜在错误</em></div><pre><code>${escapeHtml(lesson.buggyCode)}</code></pre></div><p class="question-label">代码诊断</p><p><strong>${lesson.prompt}</strong></p><div class="answer-grid"><label>你的分析<textarea id="analysisAnswer" placeholder="建议使用：位置 → 原因 → 后果 → 修改方案">${escapeHtml(answer.text || "")}</textarea></label><label>给助教的反问<textarea id="reflectionAnswer" placeholder="例如：如果 n=0，这段代码还成立吗？">${escapeHtml(answer.reflection || "")}</textarea></label></div>`;
}
function feedbackTemplate(lesson) {
  const answer = state.answers[lesson.id] || {};
  const result = answer.result || evaluateCurrent(lesson);
  return `<div class="feedback-hero"><div><p class="eyebrow">本次形成性评价</p><h3>你已经从“找答案”走向“解释答案”</h3><p class="lead">系统依据选择题、代码诊断和反问进行规则化评价。分数用于发现下一步，不用于排名。</p></div><div class="score-orb" style="--score:${result.overall}"><div><strong>${result.overall}</strong><small>/ 100</small></div></div></div><div class="rubric-list">${[["正确性","correctness","是否判断正确并定位错误"],["表达规范","clarity","分析是否完整、清楚、可复查"],["分析深度","depth","是否解释原因与后果"],["反问质量","inquiry","能否提出边界或反例"]].map(([label,key,desc])=>`<article class="rubric"><div class="rubric-head"><span>${label}</span><strong>${result.dimensions[key]}</strong></div><p>${desc}</p></article>`).join("")}</div><div class="concept-grid"><article class="concept"><span>做得好的地方</span><strong>${result.strengths[0]}</strong><p>${result.strengths.slice(1).join("；") || "继续保持逐步推理。"}</p></article><article class="concept"><span>下一步建议</span><strong>${result.next[0]}</strong><p>${result.next.slice(1).join("；") || "尝试迁移到新问题。"}</p></article><article class="concept"><span>参考思路</span><strong>完成自评后再对照</strong><p>${lesson.reference}</p></article></div>`;
}

function escapeHtml(value="") { return value.replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char])); }
function evaluateCurrent(lesson) {
  const answer = state.answers[lesson.id] || {};
  const result = evaluateAnswer({ text: answer.text, reflection: answer.reflection, choiceCorrect: answer.choice === lesson.prediction.answer, keywords: lesson.keywords });
  answer.result = result; state.answers[lesson.id] = answer; return result;
}
function captureInputs(lesson) {
  const answer = state.answers[lesson.id] || {};
  const radio = document.querySelector('input[name="prediction"]:checked');
  if (radio) answer.choice = Number(radio.value);
  if ($("#analysisAnswer")) answer.text = $("#analysisAnswer").value.trim();
  if ($("#reflectionAnswer")) answer.reflection = $("#reflectionAnswer").value.trim();
  state.answers[lesson.id] = answer;
}
function finishLesson(lesson) {
  const answer = state.answers[lesson.id];
  const existingIndex = state.sessions.findIndex((item) => item.lessonId === lesson.id);
  const session = { lessonId: lesson.id, lessonTitle: lesson.title, completedAt: new Date().toISOString(), result: answer.result };
  if (existingIndex >= 0) state.sessions[existingIndex] = session; else state.sessions.unshift(session);
  saveSessions(); toast("学习记录已保存到教师观察台");
}

function render() {
  const lesson = lessons[state.lessonIndex];
  renderLessonList();
  $("#lessonTitle").textContent = lesson.title;
  $("#lessonLabel").textContent = `学习路径 · 0${state.lessonIndex + 1}`;
  $("#objectives").innerHTML = lesson.objectives.map((item) => `<div class="objective">${item}</div>`).join("");
  const percent = (state.step + 1) * 25;
  $("#stepText").textContent = `第 ${state.step + 1} / 4 步`;
  $("#progressPercent").textContent = `${percent}%`;
  $("#progressBar").style.width = `${percent}%`;
  const steps = [
    ["先建立知识骨架", "核心讲解", conceptTemplate],
    ["预测程序行为", "代码阅读", codeTemplate],
    ["定位并解释错误", "苏格拉底式纠错", challengeTemplate],
    ["查看证据化反馈", "多维评价", feedbackTemplate]
  ];
  const [hint, tag, template] = steps[state.step];
  $("#stageHint").textContent = hint; $("#strategyTag").textContent = tag;
  $("#stageContent").innerHTML = template(lesson);
  $("#backButton").disabled = state.step === 0;
  $("#nextButton").textContent = state.step === 3 ? "完成并查看教师端" : ["我理解了，继续", "提交预测", "生成多维评价"][state.step];
  document.querySelectorAll(".choice").forEach((choice) => choice.addEventListener("click", () => { document.querySelectorAll(".choice").forEach((c) => c.classList.remove("selected")); choice.classList.add("selected"); }));
}

$("#nextButton").addEventListener("click", () => {
  const lesson = lessons[state.lessonIndex]; captureInputs(lesson); const answer = state.answers[lesson.id] || {};
  if (state.step === 1 && answer.choice === undefined) return toast("请先选择你预测的运行结果");
  if (state.step === 2 && (!answer.text || answer.text.length < 12)) return toast("请写出至少一条错误原因和修改建议");
  if (state.step === 2) evaluateCurrent(lesson);
  if (state.step < 3) { state.step += 1; render(); window.scrollTo({top:0,behavior:"smooth"}); }
  else { finishLesson(lesson); switchView("teacher"); }
});
$("#backButton").addEventListener("click", () => { captureInputs(lessons[state.lessonIndex]); if (state.step > 0) state.step -= 1; render(); });

function switchView(name) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  $(`#${name}View`).classList.add("active");
  if (name === "teacher") renderDashboard();
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));

function demoSessions() {
  return [
    { lessonId:"demo-array", lessonTitle:"数组与索引", completedAt:new Date(Date.now()-86400000).toISOString(), result:{overall:72,dimensions:{correctness:76,clarity:70,depth:68,inquiry:72}} },
    { lessonId:"demo-condition", lessonTitle:"条件与分支", completedAt:new Date(Date.now()-172800000).toISOString(), result:{overall:81,dimensions:{correctness:88,clarity:78,depth:74,inquiry:80}} }
  ];
}
function renderDashboard() {
  const sessions = state.sessions.length ? state.sessions : demoSessions(); const summary = aggregateSessions(sessions);
  $("#metricGrid").innerHTML = [["已完成学习单元",sessions.length,"过程记录持续积累"],["综合理解度",`${summary.overall}%`,"形成性评价，不用于排名"],["代码诊断表现",`${summary.averages.correctness}%`,"定位错误与后果"],["反问质量",`${summary.averages.inquiry}%`,"边界、反例与迁移"]].map(([label,value,small])=>`<article class="metric"><span>${label}</span><strong>${value}</strong><small>${small}</small></article>`).join("");
  const labels={correctness:"正确性",clarity:"表达规范",depth:"分析深度",inquiry:"反问质量"};
  $("#skillBars").innerHTML=Object.entries(summary.averages).map(([key,value])=>`<div class="skill-row"><strong>${labels[key]}</strong><div class="skill-track"><span style="width:${value}%"></span></div><span>${value}</span></div>`).join("");
  const weakest=Object.entries(summary.averages).sort((a,b)=>a[1]-b[1])[0];
  $("#signals").innerHTML=`<article class="signal"><strong>优先关注：${labels[weakest[0]]}</strong><p>当前均值 ${weakest[1]}。建议下一次任务增加针对性追问，而不是重复整道题。</p></article><article class="signal"><strong>边界条件仍是高频错误源</strong><p>可安排 n=0、n=1 与最大值三组对照测试。</p></article><article class="signal"><strong>已具备迁移学习条件</strong><p>完成基础纠错后，可让学生自己设计一个错误示例。</p></article>`;
  $("#activityTable").innerHTML=`<div class="activity-row header"><span>学习单元</span><span>完成时间</span><span>综合评价</span><span>状态</span></div>${sessions.map((item)=>`<div class="activity-row"><strong>${item.lessonTitle}</strong><span>${new Date(item.completedAt).toLocaleDateString("zh-CN")}</span><span>${item.result.overall} / 100</span><span class="badge">已完成</span></div>`).join("")}`;
}
$("#resetButton").addEventListener("click",()=>{state.sessions=[];localStorage.removeItem(storageKey);renderDashboard();renderLessonList();toast("本地演示数据已重置");});
$("#exportButton").addEventListener("click",()=>{const data=JSON.stringify({exportedAt:new Date().toISOString(),sessions:state.sessions.length?state.sessions:demoSessions()},null,2);const blob=new Blob([data],{type:"application/json"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="xunma-learning-records.json";link.click();URL.revokeObjectURL(link.href);toast("学习记录已导出");});

render();
