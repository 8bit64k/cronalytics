/**
 * Cronalytics Chinese (Simplified) catalog
 *
 * Organized by namespace matching component names for discoverability.
 */

import { registerCatalog } from "./index.js";

registerCatalog("zh", {
  // HeroBanner
  hero: {
    title: "CRONALYTICS",
    tagline: "观察。衡量。优化。",
    pronunciation: "/ˈkrɒn.əˌlɪt.ɪks/",
    noun: "(名词)",
    definition_1: "1. Cron 分析与可观测性。",
    definition_2: "2. Hermes 中智能自动化的仪表板。",
    expand_tooltip: "展开欢迎横幅",
    collapse_tooltip: "收起欢迎横幅",
  },

  // SummaryBoard
  summary: {
    job_runs: "任务运行",
    cost: "成本",
    wasted: "浪费",
    tokens: "令牌",
    cached: "缓存",
    pace: "节奏",
    trend: "趋势",
    estimated: "预估",
    actual: "实际",
    all_time: "全部时间",
    last_n_days: "最近 {n} 天",
    vs_prior: "对比上期",
    period: "周期",
    nominal: "标称",
    in: "输入",
    out: "输出",
    no_schedule: "无计划",
  },

  // LeaderBoard
  leaderboard: {
    title: "排行榜",
    top_est_cost: "最高成本",
    top_runs: "最多运行",
    top_tokens: "最多令牌",
    top_duration: "最长时间",
    most_efficient: "最高节奏",
    of_total_est_cost: "占总预估成本 %",
    of_total_runs: "占总运行数 %",
    of_total_tokens: "占总令牌数 %",
  },

  // JobBreakdown
  job_breakdown: {
    title: "任务明细",
    job: "任务",
    runs: "运行",
    avg_time: "平均时长",
    est_cost: "预估成本",
    avg_est_cost: "平均预估成本",
    nominal_mo: "标称/月",
    trend_mo: "趋势/月",
    pace: "节奏",
    mode_agent: "智能体",
    mode_no_agent: "无智能体",
    no_schedule: "无计划",
    last: "上次",
    using: "使用",
    next: "下次",
    see_runs: "查看运行",
    schedule: "计划",
    last_run: "上次运行",
    no_jobs_window: "{window} 内无任务。上次同步：{time} UTC",
    no_jobs_sync: "未捕获到定时任务。点击立即同步以从 state.db 回填。",
    sorted_by: "按 {col} {dir} 排序",
    sort_by: "按 {col} 排序",
    ascending: "升序",
    descending: "降序",
  },

  // JobDetailView
  job_detail: {
    title_runs: "运行",
    mode: "模式",
    mode_agent: "智能体",
    duration: "时长",
    est_cost: "预估成本",
    loading: "加载运行记录...",
    error_prefix: "错误：",
    for_full_history: " 查看完整历史。",
    no_runs: "未找到运行记录。",
    showing: "显示 ",
    of: " / ",
    runs_plural: "运行",
    use_cli: "使用 ",
    run: "运行",
  },

  // ModelBreakdown
  model_breakdown: {
    title: "模型分布",
    model: "模型",
    runs: "运行",
    est_cost: "预估成本",
    and_more: "还有 {n} 个",
  },

  // SparkLine
  sparkline: {
    daily_cost: "每日预估成本",
    daily_runs: "每日运行",
    cost_bar: "\u2014 成本（柱状）\u00b7 ",
    tokens_line: "\u2014 令牌",
    duration_line: "- - 时长",
  },

  // DaySelector
  day_selector: {
    label: "天数",
    apply_custom: "应用自定义天数",
    go: "执行",
  },

  // ModeToggle
  mode_toggle: {
    label: "模式",
    all: "全部",
    agent: "智能体",
    no_agent: "无智能体",
  },

  // OutcomeToggle
  outcome_toggle: {
    label: "结果",
    all: "全部",
    success: "成功",
    failure: "失败",
  },

  // ErrorBoundary
  error: {
    title: "Cronalytics 错误",
    message: "出了点问题。请刷新页面或联系支持。",
  },

  // Modal
  modal: {
    close: "关闭",
  },

  // Pace modal explainer
  pace: {
    what_this_means: "节奏将你实际支出的趋势与你在定时任务定义中设定的预算进行比较。它回答了：\u2018按照这个速度，我是超支还是节约？\u2019",
    nominal_formula: "标称 = 计划运行次数 \u00d7 每次平均成本",
    trend_formula: "趋势     = 实际运行次数 \u00d7 每次平均成本",
    pace_formula: "节奏      = 趋势 / 标称",
  },

  // Runs modal explainer
  runs: {
    what_this_means: "在所选窗口中记录的定时任务执行总次数。每次运行都会触发你的计划任务——无论成功、失败还是重试。",
    trend_formula: "趋势 % = ((当前运行数 \u2212 上期运行数) / 上期运行数) \u00d7 100",
    trend_note: "正值 = 比上期运行更多。负值 = 比上期运行更少。",
  },

  // Cost modal explainer
  cost: {
    what_this_means: "预估成本根据令牌使用量和模型定价计算得出。实际成本可能因提供商计费粒度不同而略有差异。",
    trend_formula: "趋势 % = ((当前成本 \u2212 上期成本) / 上期成本) \u00d7 100",
  },

  // Tokens modal explainer
  tokens: {
    what_this_means: "令牌是 LLM 使用的计量单位。输入令牌是你的提示词 + 上下文。输出令牌是模型的响应。缓存令牌来自具有相同前缀的重复提示词（更便宜）。",
  },

  // Shared / generic
  shared: {
    loading: "加载中\u2026",
    retry: "重试",
    show: "显示",
    hide: "隐藏",
    refresh: "刷新",
    sync_now: "立即同步",
    synced_n_runs: "已同步 {n} 次运行",
    what_this_means: "这是什么意思",
    how_its_calculated: "如何计算",
    trend_calculation: "趋势计算",
    window_context: "窗口上下文",
    showing_window: "显示 ",
    prior_window_note: "上期对比窗口是将相同时长向后平移。",
    job_details: "任务详情",
    color_guide: "颜色指南",
    neutral_budget: "中性 (1.0\u20132.0\u00d7) \u2014 正常范围内。",
    green_under_budget: "绿色 (< 1.0\u00d7) \u2014 低于预算。支出低于计划。",
    red_over_budget: "红色 (> 2.0\u00d7) \u2014 超出预算。支出超过计划。",
    all_scaled_30d: "全部按所选窗口折算为 30 天。",
    breakdown: "明细",
  },
});
