import { lessons } from "./content.js";
import { aggregateSessions, deriveLearningSignals, evaluateAnswer } from "./evaluator.js";

const $ = (selector) => document.querySelector(selector);
const storageKey = "xunma-learning-sessions-v2";
const draftKey = "xunma-learning-draft-v2";
const state = { lessonIndex: 0, step: 0, answers: {}, sessions: loadJson(storageKey, []), startedAt: Date.now(), attempts: 0, hintsUsed: 0, usingDemo: false, filter: "all" };

function loadJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveSessions() { localStorage.setItem(storageKey, JSON.stringify(state.sessions)); }
function saveDraft() { localStorage.setItem(draftKey, JSON.stringify({ lessonIndex: state.lessonIndex, step: state.step, answers: state.answers, savedAt: new Date().toISOString() })); updateResumeCard(); }
function clearDraft() { localStorage.removeItem(draftKey); updateResumeCard(); }
function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2200); }
function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char])); }

function updateResumeCard() {
  const draft = loadJson(draftKey, null); const card = $("#resumeCard");
  if (!draft || !lessons[draft.lessonIndex] || draft.step === 0) { card.hidden = true; return; }
  card.hidden = false; $("#resumeTitle").textContent = `${lessons[draft.lessonIndex].title} · 第 ${draft.step + 1} 步`;
}

function renderLessonList() {
  $("#lessonList").innerHTML = lessons.map((lesson, index) => {
    const session = state.sessions.find((item) => item.lessonId === lesson.id);
    return `<button class="lesson-button ${index === state.lessonIndex ? "active" : ""}" data-lesson="${index}" aria-label="学习${lesson.title}"><span class="lesson-index">0${index + 1}</span><span class="lesson-copy"><strong>${lesson.title}</strong><small>${lesson.level}</small></span><span class="lesson-state">${session ? `${session.result.overall}` : "→"}</span></button>`;
  }).join("");
  document.querySelectorAll("[data-lesson]").forEach((button) => button.addEventListener("click", () => {
    captureInputs(lessons[state.lessonIndex]); state.lessonIndex = Number(button.dataset.lesson); state.step = 0; state.startedAt = Date.now(); state.attempts = 0; state.hintsUsed = 0; render(); saveDraft();
  }));
}

function conceptTemplate(lesson) {
  return `<h3>${lesson.concept.title}</h3><p class="lead">${lesson.concept.lead}</p><div class="concept-grid">${lesson.concept.cards.map(([n,t,p]) => `<article class="concept"><span>${n}</span><strong>${t}</strong><p>${p}</p></article>`).join("")}</div><div class="checkpoint"><span>✦</span><div><strong>停一下，先在脑中回答</strong><br>${lesson.concept.checkpoint}</div></div>`;
}
function codeTemplate(lesson) {
  const answer = state.answers[lesson.id] || {};
  return `<h3>先预测，再验证</h3><p class="lead">阅读代码时，不要凭感觉。用纸笔记录关键变量每一轮的变化。</p><div class="code-card"><div class="code-toolbar"><i></i><i></i><i></i><span>main.cpp</span><em>规范示例</em></div><pre><code>${escapeHtml(lesson.code)}</code></pre></div><span class="question-label">理解检查 · 单选</span><p><strong>${lesson.prediction.question}</strong></p><div class="choice-list">${lesson.prediction.choices.map((choice,index)=>`<label class="choice ${answer.choice === index ? "selected" : ""}"><input type="radio" name="prediction" value="${index}" ${answer.choice === index ? "checked" : ""}>${choice}</label>`).join("")}</div><div class="confidence"><div><strong>你对这个判断有多确定？</strong><small>记录“会不会”与“以为自己会不会”的差异</small></div><input id="confidenceInput" type="range" min="1" max="5" value="${answer.confidence || 3}" aria-label="答题置信度"><output id="confidenceOutput">${["很不确定","不太确定","一般","比较确定","非常确定"][(answer.confidence || 3)-1]}</output></div>`;
}
function challengeTemplate(lesson) {
  const answer = state.answers[lesson.id] || {}; const hintCount = answer.hintsUsed || 0;
  return `<h3>这段代码“能编译”就一定正确吗？</h3><p class="lead">下面是助教故意加入问题的版本。请像代码审查者一样，定位问题并解释后果。</p><div class="code-card"><div class="code-toolbar"><i></i><i></i><i></i><span>challenge.cpp</span><em>含潜在错误</em></div><pre><code>${escapeHtml(lesson.buggyCode)}</code></pre></div><p class="question-label">代码诊断</p><p><strong>${lesson.prompt}</strong></p><div class="hint-zone"><div><strong>需要一点提示？</strong><span>提示会逐级变具体，并记录在学习过程中。</span></div><button id="hintButton" class="button hint" ${hintCount >= lesson.hints.length ? "disabled" : ""}>${hintCount ? "再给一点提示" : "查看第 1 级提示"}</button></div><div id="hintList" class="hint-list">${lesson.hints.slice(0,hintCount).map((hint,index)=>`<div><span>${index+1}</span>${hint}</div>`).join("")}</div><div class="answer-grid"><label>你的分析<textarea id="analysisAnswer" placeholder="建议使用：位置 → 原因 → 后果 → 修改方案">${escapeHtml(answer.text || "")}</textarea></label><label>给助教的反问<textarea id="reflectionAnswer" placeholder="例如：如果 n=0，这段代码还成立吗？">${escapeHtml(answer.reflection || "")}</textarea></label></div>`;
}
function feedbackTemplate(lesson) {
  const answer = state.answers[lesson.id] || {}; const result = answer.result || evaluateCurrent(lesson);
  const evidence = result.matchedKeywords.length ? result.matchedKeywords.join(" · ") : "尚未匹配到关键概念词";
  return `<div class="feedback-hero"><div><p class="eyebrow">本次形成性评价</p><h3>你已经从“找答案”走向“解释答案”</h3><p class="lead">系统依据选择题、代码诊断和反问进行透明规则评价。分数用于发现下一步，不用于排名。</p></div><div class="score-orb" style="--score:${result.overall}"><div><strong>${result.overall}</strong><small>/ 100</small></div></div></div><div class="evidence-strip"><span>预测 ${answer.choice === lesson.prediction.answer ? "正确" : "需复盘"}</span><span>置信度 ${answer.confidence || 3}/5</span><span>使用提示 ${answer.hintsUsed || 0} 次</span></div><div class="rubric-list">${[["正确性","correctness","是否判断正确并定位错误"],["表达规范","clarity","分析是否完整、清楚、可复查"],["分析深度","depth","是否解释原因与后果"],["反问质量","inquiry","能否提出边界或反例"]].map(([label,key,desc])=>`<article class="rubric"><div class="rubric-head"><span>${label}</span><strong>${result.dimensions[key]}</strong></div><div class="mini-track"><i style="width:${result.dimensions[key]}%"></i></div><p>${desc}</p></article>`).join("")}</div><div class="concept-grid"><article class="concept"><span>做得好的地方</span><strong>${result.strengths[0]}</strong><p>${result.strengths.slice(1).join("；") || "继续保持逐步推理。"}</p></article><article class="concept"><span>下一步建议</span><strong>${result.next[0]}</strong><p>${result.next.slice(1).join("；") || "尝试迁移到新问题。"}</p></article><article class="concept"><span>评价证据</span><strong>${evidence}</strong><p>参考思路：${lesson.reference}</p></article></div>`;
}

function evaluateCurrent(lesson) {
  const answer = state.answers[lesson.id] || {};
  const result = evaluateAnswer({ text: answer.text, reflection: answer.reflection, choiceCorrect: answer.choice === lesson.prediction.answer, keywords: lesson.keywords });
  answer.result = result; state.answers[lesson.id] = answer; return result;
}
function captureInputs(lesson) {
  const answer = state.answers[lesson.id] || {}; const radio = document.querySelector('input[name="prediction"]:checked');
  if (radio) answer.choice = Number(radio.value); if ($("#confidenceInput")) answer.confidence = Number($("#confidenceInput").value);
  if ($("#analysisAnswer")) answer.text = $("#analysisAnswer").value.trim(); if ($("#reflectionAnswer")) answer.reflection = $("#reflectionAnswer").value.trim(); state.answers[lesson.id] = answer;
}
function finishLesson(lesson) {
  const answer = state.answers[lesson.id]; const existingIndex = state.sessions.findIndex((item) => item.lessonId === lesson.id);
  const session = { lessonId: lesson.id, lessonTitle: lesson.title, completedAt: new Date().toISOString(), result: answer.result, choiceCorrect: answer.choice === lesson.prediction.answer, confidence: answer.confidence || 3, hintsUsed: answer.hintsUsed || 0, attempts: state.attempts || 1, durationSeconds: Math.max(20, Math.round((Date.now() - state.startedAt) / 1000)) };
  if (existingIndex >= 0) state.sessions[existingIndex] = session; else state.sessions.unshift(session); saveSessions(); clearDraft(); toast("学习记录已保存到教师观察台");
}
function updateStrategyFlow() { document.querySelectorAll("#strategyFlow span").forEach((item,index) => item.classList.toggle("done", index <= state.step)); }
function bindStageEvents(lesson) {
  document.querySelectorAll(".choice").forEach((choice) => choice.addEventListener("click", () => { document.querySelectorAll(".choice").forEach((item) => item.classList.remove("selected")); choice.classList.add("selected"); captureInputs(lesson); saveDraft(); }));
  if ($("#confidenceInput")) $("#confidenceInput").addEventListener("input", (event) => { const labels = ["很不确定","不太确定","一般","比较确定","非常确定"]; $("#confidenceOutput").textContent = labels[Number(event.target.value)-1]; captureInputs(lesson); saveDraft(); });
  if ($("#hintButton")) $("#hintButton").addEventListener("click", () => { captureInputs(lesson); const answer = state.answers[lesson.id] || {}; answer.hintsUsed = Math.min((answer.hintsUsed || 0) + 1, lesson.hints.length); state.hintsUsed = answer.hintsUsed; state.answers[lesson.id] = answer; render(); saveDraft(); });
  ["#analysisAnswer", "#reflectionAnswer"].forEach((selector) => { const field = $(selector); if (field) field.addEventListener("input", () => { captureInputs(lesson); saveDraft(); }); });
}
function render() {
  const lesson = lessons[state.lessonIndex]; renderLessonList(); updateResumeCard(); $("#lessonTitle").textContent = lesson.title; $("#lessonLabel").textContent = `学习路径 · 0${state.lessonIndex + 1}`; $("#objectives").innerHTML = lesson.objectives.map((item) => `<div class="objective">${item}</div>`).join("");
  const percent = (state.step + 1) * 25; $("#stepText").textContent = `第 ${state.step + 1} / 4 步`; $("#progressPercent").textContent = `${percent}%`; $("#progressBar").style.width = `${percent}%`;
  const steps = [["先建立知识骨架","核心讲解",conceptTemplate],["预测程序行为","代码阅读",codeTemplate],["定位并解释错误","苏格拉底式纠错",challengeTemplate],["查看证据化反馈","多维评价",feedbackTemplate]];
  const [hint, tag, template] = steps[state.step]; $("#stageHint").textContent = hint; $("#strategyTag").textContent = tag; $("#stageContent").innerHTML = template(lesson); $("#backButton").disabled = state.step === 0; $("#nextButton").textContent = state.step === 3 ? "完成并查看教师端" : ["我理解了，继续","提交预测","生成多维评价"][state.step]; updateStrategyFlow(); bindStageEvents(lesson);
}

$("#nextButton").addEventListener("click", () => {
  const lesson = lessons[state.lessonIndex]; captureInputs(lesson); const answer = state.answers[lesson.id] || {};
  if (state.step === 1 && answer.choice === undefined) return toast("请先选择你预测的运行结果"); if (state.step === 1) state.attempts += 1;
  if (state.step === 2 && (!answer.text || answer.text.length < 12)) return toast("请写出至少一条错误原因和修改建议"); if (state.step === 2) evaluateCurrent(lesson);
  if (state.step < 3) { state.step += 1; render(); saveDraft(); window.scrollTo({top:0,behavior:"smooth"}); } else { finishLesson(lesson); switchView("teacher"); }
});
$("#backButton").addEventListener("click", () => { captureInputs(lessons[state.lessonIndex]); if (state.step > 0) state.step -= 1; render(); saveDraft(); });
$("#resumeButton").addEventListener("click", () => { const draft = loadJson(draftKey, null); if (!draft) return; state.lessonIndex = draft.lessonIndex; state.step = draft.step; state.answers = draft.answers || {}; render(); toast("已恢复上次学习进度"); });
function switchView(name) { document.querySelectorAll(".view").forEach((view) => view.classList.remove("active")); document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === name)); $(`#${name}View`).classList.add("active"); if (name === "teacher") renderDashboard(); window.scrollTo({top:0,behavior:"smooth"}); }
document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));

function demoSessions() {
  return [
    { lessonId:"array",lessonTitle:"数组与索引",completedAt:new Date(Date.now()-86400000).toISOString(),durationSeconds:720,attempts:2,hintsUsed:2,confidence:4,choiceCorrect:false,result:{overall:72,dimensions:{correctness:66,clarity:78,depth:70,inquiry:74}} },
    { lessonId:"condition",lessonTitle:"条件与分支",completedAt:new Date(Date.now()-172800000).toISOString(),durationSeconds:540,attempts:1,hintsUsed:0,confidence:2,choiceCorrect:true,result:{overall:81,dimensions:{correctness:88,clarity:78,depth:74,inquiry:80}} }
  ];
}
function emptyState(message) { return `<div class="empty-state"><span>◎</span><p>${message}</p></div>`; }
function renderDashboard() {
  const sourceSessions = state.usingDemo ? demoSessions() : state.sessions; const sessions = state.filter === "all" ? sourceSessions : sourceSessions.filter((item) => item.lessonId === state.filter); const notice = $("#dataNotice"); notice.classList.toggle("demo", state.usingDemo);
  notice.innerHTML = state.usingDemo ? "<strong>匿名示例模式</strong><span>这些是虚构数据，仅用于展示教师端分析方式，不代表真实学生。</span>" : "<strong>隐私说明</strong><span>当前仅展示此浏览器中的真实学习记录，不上传服务器。</span>"; $("#demoButton").textContent = state.usingDemo ? "返回真实记录" : "载入匿名示例";
  const summary = aggregateSessions(sessions);
  $("#metricGrid").innerHTML = [["已完成学习单元",sessions.length,"本地过程记录"],["综合理解度",sessions.length?`${summary.overall}%`:"—","形成性评价，不用于排名"],["累计学习时长",sessions.length?`${summary.totalMinutes} 分钟`:"—","从进入单元到完成"],["平均尝试次数",sessions.length?summary.averageAttempts:"—","用于识别反复卡点"]].map(([label,value,small])=>`<article class="metric"><span>${label}</span><strong>${value}</strong><small>${small}</small></article>`).join("");
  const labels={correctness:"正确性",clarity:"表达规范",depth:"分析深度",inquiry:"反问质量"}; $("#skillBars").innerHTML = sessions.length ? Object.entries(summary.averages).map(([key,value])=>`<div class="skill-row"><strong>${labels[key]}</strong><div class="skill-track"><span style="width:${value}%"></span></div><span>${value}</span></div>`).join("") : emptyState("完成一个学习单元后，这里会生成能力画像。");
  const signals = deriveLearningSignals(sessions); $("#signals").innerHTML = signals.length ? signals.map((item)=>`<article class="signal ${item.level}"><strong>${item.title}</strong><p>${item.detail}</p></article>`).join("") : emptyState("暂无风险信号。你可以先在学生学习台完成一个单元。");
  $("#activityTable").innerHTML = sessions.length ? `<div class="activity-row header"><span>学习单元</span><span>完成时间</span><span>学习证据</span><span>评价</span><span>状态</span></div>${sessions.map((item)=>`<div class="activity-row"><strong>${item.lessonTitle}</strong><span>${new Date(item.completedAt).toLocaleDateString("zh-CN")}</span><span>${Math.max(1,Math.round((item.durationSeconds||0)/60))} 分钟 · ${item.hintsUsed||0} 提示</span><span>${item.result.overall} / 100</span><span class="badge">已完成</span></div>`).join("")}` : emptyState("还没有真实学习记录。可先完成一个单元，或载入匿名示例查看效果。");
}
function downloadFile(content, filename, type) { const blob = new Blob([content], {type}); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }
$("#demoButton").addEventListener("click", () => { state.usingDemo = !state.usingDemo; renderDashboard(); });
$("#lessonFilter").innerHTML += lessons.map((lesson)=>`<option value="${lesson.id}">${lesson.title}</option>`).join(""); $("#lessonFilter").addEventListener("change", (event) => { state.filter = event.target.value; renderDashboard(); });
$("#resetButton").addEventListener("click",()=>{ state.sessions=[]; state.usingDemo=false; localStorage.removeItem(storageKey); renderDashboard(); renderLessonList(); toast("本地学习记录已清除"); });
$("#exportButton").addEventListener("click",()=>{ const data=JSON.stringify({schemaVersion:2,exportedAt:new Date().toISOString(),privacy:"local-only",sessions:state.usingDemo?demoSessions():state.sessions},null,2); downloadFile(data,"xunma-learning-records.json","application/json"); toast("JSON 学习记录已导出"); });
$("#csvButton").addEventListener("click",()=>{ const sessions=state.usingDemo?demoSessions():state.sessions; const rows=[["学习单元","完成时间","综合评价","正确性","表达规范","分析深度","反问质量","置信度","提示次数","尝试次数","学习秒数"],...sessions.map((item)=>[item.lessonTitle,item.completedAt,item.result.overall,item.result.dimensions.correctness,item.result.dimensions.clarity,item.result.dimensions.depth,item.result.dimensions.inquiry,item.confidence||3,item.hintsUsed||0,item.attempts||1,item.durationSeconds||0])]; const csv="\ufeff"+rows.map((row)=>row.map((cell)=>`"${String(cell).replaceAll('"','""')}"`).join(",")).join("\n"); downloadFile(csv,"xunma-learning-records.csv","text/csv;charset=utf-8"); toast("CSV 学习记录已导出"); });

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
updateResumeCard(); render();
