import { registerCatalog } from "./index.js";

registerCatalog("zh", {
  // cost
  cost: {
    trend_formula: "趋势 % = ((当前成本 − 上期成本) / 上期成本) × 100",
    what_this_means: "预估成本根据令牌使用量和模型定价计算。实际成本可能因服务商计费粒度而略有差异。",
  },
  // day_selector
  day_selector: {
    apply_custom: "应用自定义天数",
    go: "确定",
    label: "天数",
  },
  // error
  error: {
    message: "出现问题，请刷新页面或联系支持。",
    title: "Cronalytics 错误",
  },
  // hero
  hero: {
    collapse_tooltip: "收起横幅",
    definition_1: "1. Cron 分析与可观测性。",
    definition_2: "2. Hermes 中智能代理自动化的仪表板。",
    expand_tooltip: "展开横幅",
    noun: "(名词)",
    pronunciation: "/ˈkrɒn.əˌlɪt.ɪks/",
    tagline: "观察。衡量。优化。",
    title: "CRONALYTICS",
  },
  // job_breakdown
  job_breakdown: {
    ascending: "升序",
    avg_est_cost: "平均预估成本",
    avg_time: "平均耗时",
    descending: "降序",
    est_cost: "预估成本",
    job: "任务",
    last: "上次",
    last_run: "上次运行",
    mode_agent: "智能体",
    mode_no_agent: "无智能体",
    next: "下次",
    no_jobs_sync: "未捕获到定时任务。点击立即同步从 state.db 回填。",
    no_jobs_window: "{window} 内无任务。上次同步：{time} UTC",
    no_schedule: "无计划",
    nominal_mo: "标称/月",
    pace: "执行率",
    runs: "运行",
    schedule: "计划",
    see_runs: "查看运行",
    sort_by: "按 {col} 排序",
    sorted_by: "按 {col} {dir} 排序",
    title: "任务明细",
    trend_mo: "趋势/月",
    using: "使用",
  },
  // job_detail
  job_detail: {
    duration: "耗时",
    error_prefix: "错误：",
    est_cost: "预估成本",
    for_full_history: " 查看完整历史。",
    loading: "加载运行记录...",
    mode: "模式",
    mode_agent: "智能体",
    no_runs: "未找到运行记录。",
    of: " / ",
    result: "结果",
    run: "次运行",
    runs_plural: "次运行",
    showing: "显示 ",
    title_runs: "运行记录",
    use_cli: "使用 ",
  },
  // leaderboard
  leaderboard: {
    most_efficient: "最佳执行率",
    of_total_est_cost: "占预估总成本 %",
    of_total_runs: "占总运行数 %",
    of_total_tokens: "占总令牌数 %",
    title: "排行榜",
    top_duration: "最长时长",
    top_est_cost: "最高成本",
    top_runs: "最多运行",
    top_tokens: "Token 最多",
  },
  // modal
  modal: {
    close: "关闭",
  },
  // mode_toggle
  mode_toggle: {
    agent: "智能体",
    all: "全部",
    label: "模式",
    no_agent: "无智能体",
  },
  // model_breakdown
  model_breakdown: {
    and_more: "还有 {n} 个",
    est_cost: "预估成本",
    model: "模型",
    runs: "运行",
    title: "模型分布",
  },
  // outcome_toggle
  outcome_toggle: {
    all: "全部",
    failure: "失败",
    label: "结果",
    success: "成功",
  },
  // pace
  pace: {
    nominal_formula: "标称 = 计划运行次数 × 每次平均成本",
    pace_formula: "执行率     = 趋势 / 标称",
    trend_formula: "趋势 = 实际运行次数 × 每次平均成本",
    what_this_means: "执行率将你的实际支出趋势与你在定时任务定义中设定的预算进行比较。它回答：‘按照这个速度，我是超支还是节约？’",
  },
  // runs
  runs: {
    trend_formula: "趋势 % = ((当前运行数 − 上期运行数) / 上期运行数) × 100",
    trend_note: "正值 = 比上期运行更多。负值 = 比上期运行更少。",
    what_this_means: "所选窗口内记录的定时任务执行总次数。每次运行都会触发你的计划任务——无论成功、失败还是重试。",
  },
  // shared
  shared: {
    all_scaled_30d: "使用所选窗口折算为 30 天。",
    breakdown: "明细",
    color_guide: "颜色说明",
    green_under_budget: "绿色 (< 1.0×) — 低于预算，支出少于计划。",
    hide: "隐藏",
    how_its_calculated: "如何计算",
    job_details: "任务详情",
    loading: "加载中…",
    neutral_budget: "中性 (1.0–2.0×) — 正常范围内，轻微波动。",
    prior_window_note: "上期对比窗口是将相同时长向后平移所得。",
    red_over_budget: "红色 (> 2.0×) — 超出预算，支出多于计划。",
    refresh: "刷新",
    retry: "重试",
    show: "显示",
    showing_window: "显示 ",
    sync_now: "立即同步",
    synced_n_runs: "已同步 {n} 次运行",
    trend_calculation: "趋势计算",
    what_this_means: "这是什么意思",
    window_context: "窗口上下文",
  },
  // sparkline
  sparkline: {
    cost_bar: "— 成本（柱状）· ",
    daily_cost: "每日预估成本",
    daily_runs: "每日运行",
    duration_line: "- - 时长",
    tokens_line: "— Token",
  },
  // summary
  summary: {
    actual: "实际",
    all_time: "全部时间",
    cached: "缓存",
    cost: "成本",
    estimated: "预估",
    in: "输入",
    job_runs: "任务运行",
    last_n_days: "最近 {n} 天",
    no_schedule: "无计划",
    nominal: "标称",
    out: "输出",
    pace: "执行率",
    period: "周期",
    tokens: "Token",
    trend: "趋势",
    vs_prior: "对比上期",
    wasted: "浪费",
  },
  // tokens
  tokens: {
    what_this_means: "令牌是 LLM 使用的计量单位。输入令牌是你的提示词 + 上下文。输出令牌是模型的响应。缓存令牌来自具有相同前缀的重复提示词（更便宜）。",
  },
});