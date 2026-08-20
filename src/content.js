export const lessons = [
  {
    id: "loop-sum",
    title: "循环与累加器",
    level: "基础 · 12 分钟",
    objectives: ["区分循环变量与累加器", "手算并预测程序输出", "识别边界条件错误"],
    concept: {
      title: "累加，本质上是不断更新“到目前为止的答案”",
      lead: "当问题要求把一组数合并成一个结果时，我们通常创建一个保存中间结果的变量。每轮循环只完成一小步，循环结束时它才是最终答案。",
      cards: [
        ["01 · 初始值", "sum = 0", "加法累加器从 0 开始，因为 0 不改变加法结果。"],
        ["02 · 重复规则", "sum += i", "把当前 i 加入之前已经得到的结果。"],
        ["03 · 边界", "i <= n", "题目是否包含 n，决定了边界写 < 还是 <=。"]
      ],
      checkpoint: "请先不要背代码：如果要计算 1+2+3，sum 会依次变成哪些值？"
    },
    code: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int n = 5;\n    int sum = 0;\n    for (int i = 1; i <= n; ++i) {\n        sum += i;\n    }\n    cout << sum << endl;\n    return 0;\n}`,
    buggyCode: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int n = 5;\n    int sum;\n    for (int i = 1; i < n; ++i) {\n        sum += i;\n    }\n    cout << sum << endl;\n    return 0;\n}`,
    prediction: { question: "规范代码会输出什么？", choices: ["10", "15", "20", "无法确定"], answer: 1 },
    prompt: "错误版本中有两个问题。请指出它们，并说明每个问题可能造成什么后果。",
    hints: ["先检查每个变量在第一次被读取前是否已经有确定的值。", "再比较题目要求的范围与循环条件：最后一个数有没有被处理？", "可以分别围绕 sum 的初始值和 i < n 的边界写出两条诊断。"],
    keywords: ["初始化", "sum", "未定义", "<", "<=", "边界", "5", "垃圾值"],
    reference: "sum 没有初始化，读取未初始化的局部变量会产生未定义行为；循环条件 i < n 会漏掉 n，因此若要求累加到 n，应写 i <= n。"
  },
  {
    id: "condition",
    title: "条件与分支",
    level: "基础 · 10 分钟",
    objectives: ["理解布尔表达式", "追踪分支执行路径", "识别赋值与比较混淆"],
    concept: { title: "条件不是“猜测”，而是一道只有真与假的门", lead: "程序按条件表达式的结果选择路径。读分支代码时，先代入变量，再算表达式，最后沿唯一可执行路径走。", cards: [["01 · 比较","score >= 60","比较会产生 true 或 false。"],["02 · 路径","if / else","同一轮判断只进入一个对应分支。"],["03 · 顺序","从上到下","多分支判断先满足先执行。"]], checkpoint:"当 score=60 时，score >= 60 是真还是假？边界值必须亲自代入。" },
    code: `int score = 78;\nif (score >= 90) {\n    cout << "A";\n} else if (score >= 60) {\n    cout << "Pass";\n} else {\n    cout << "Retry";\n}`,
    buggyCode: `int score = 78;\nif (score = 90) {\n    cout << "A";\n} else if (score >= 60) {\n    cout << "Pass";\n}`,
    prediction: { question:"规范代码会输出什么？", choices:["A","Pass","Retry","没有输出"], answer:1 },
    prompt:"错误版本为什么很可能输出 A？请说明 = 和 == 的区别，并给出修改。",
    hints:["观察 if 括号里的表达式有没有改变变量本身。", "C++ 中单个等号与两个等号承担不同任务。", "赋值表达式 score = 90 的结果是非零值，因此会被当作 true。"],
    keywords:["赋值","比较","=","==","90","true","非零","条件"], reference:"score = 90 是赋值，不是比较；赋值表达式的结果为 90，非零被视为 true，所以进入第一个分支。应改为 score == 90，或按原需求保留 score >= 90。"
  },
  {
    id: "array",
    title: "数组与索引",
    level: "进阶 · 14 分钟",
    objectives: ["理解零起始索引", "判断合法访问范围", "发现越界访问"],
    concept: { title:"数组像一排编号从 0 开始的储物格", lead:"长度为 n 的数组，合法索引是 0 到 n-1。数组不会替你检查边界，因此循环条件必须和容量保持一致。", cards:[["01 · 起点","index = 0","第一个元素的索引不是 1。"],["02 · 终点","n - 1","长度为 n 时最后一个合法位置。"],["03 · 安全","i < n","访问 a[i] 时避免 i 等于 n。"]], checkpoint:"长度为 4 的数组有几个元素？最后一个元素的索引又是多少？" },
    code:`int a[4] = {3, 6, 9, 12};\nfor (int i = 0; i < 4; ++i) {\n    cout << a[i] << " ";\n}`,
    buggyCode:`int a[4] = {3, 6, 9, 12};\nfor (int i = 0; i <= 4; ++i) {\n    cout << a[i] << " ";\n}`,
    prediction:{question:"规范代码打印的最后一个数是什么？",choices:["3","9","12","不确定"],answer:2},
    prompt:"错误循环在哪一次迭代发生越界？为什么编译器不一定报错？如何修复？",
    hints:["先写出长度为 4 的数组全部合法索引。", "把 i=4 代入 a[i]，判断这个位置是否存在。", "将循环终点从 i <= 4 改为只允许 i 小于数组长度。"],
    keywords:["i=4","4","越界","0","3","i < 4","未定义","运行"],reference:"当 i=4 时访问 a[4]，但合法索引只有 0~3，因此越界并导致未定义行为。C++原生数组通常不做运行时边界检查，应将条件改为 i < 4。"
  },
  {
    id: "function",
    title: "函数与参数",
    level: "进阶 · 15 分钟",
    objectives: ["区分形参与实参", "理解值传递", "识别缺少返回值"],
    concept: { title:"函数把一个任务包装成可复用的输入—处理—输出", lead:"调用函数时，实参的值会交给形参。普通值传递会创建副本；返回值则把计算结果送回调用位置。",cards:[["01 · 输入","parameters","形参描述函数需要什么。"],["02 · 处理","function body","函数体只负责一项清晰任务。"],["03 · 输出","return","非 void 函数应返回约定类型。"]],checkpoint:"如果函数修改的是参数副本，调用者原来的变量会一起改变吗？" },
    code:`int square(int x) {\n    return x * x;\n}\n\nint n = 4;\ncout << square(n);`,
    buggyCode:`int square(int x) {\n    int result = x * x;\n}\n\nint n = 4;\ncout << square(n);`,
    prediction:{question:"规范代码会输出什么？",choices:["4","8","16","不确定"],answer:2},
    prompt:"错误版本违背了函数的哪项约定？说明风险，并写出最小修改方案。",
    hints:["先看函数声明承诺返回什么类型。", "再检查所有执行路径是否都把一个值交还给调用处。", "在函数末尾补充 return result; 即可完成最小修复。"],
    keywords:["int","返回","return","result","未定义","值"],reference:"函数声明返回 int，却没有 return 语句；到达函数末尾会导致未定义行为。最小修改是在函数体末尾写 return result;。"
  }
];
