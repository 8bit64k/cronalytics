import { registerCatalog } from "./index.js";

registerCatalog("zh-TW", {
  // cost
  cost: {
    trend_formula: "趨勢 % = ((目前成本 − 上期成本) / 上期成本) × 100",
    what_this_means: "預估成本根據令牌使用量和模型定價計算。實際成本可能因服務商計費粒度而略有差異。",
  },
  // day_selector
  day_selector: {
    apply_custom: "套用自訂天數",
    go: "確定",
    label: "天數",
  },
  // error
  error: {
    message: "發生問題，請重新整理頁面或聯絡支援。",
    title: "Cronalytics 錯誤",
  },
  // hero
  hero: {
    collapse_tooltip: "收合橫幅",
    definition_1: "1. Cron 分析與可觀測性。",
    definition_2: "2. Hermes 中智能代理自動化的儀表板。",
    expand_tooltip: "展開橫幅",
    noun: "(名詞)",
    pronunciation: "/ˈkrɒn.əˌlɪt.ɪks/",
    tagline: "觀察。衡量。最佳化。",
    title: "CRONALYTICS",
  },
  // job_breakdown
  job_breakdown: {
    ascending: "遞增",
    avg_est_cost: "平均預估成本",
    avg_time: "平均耗時",
    descending: "遞減",
    est_cost: "預估成本",
    job: "任務",
    last: "上次",
    last_run: "上次執行",
    mode_agent: "智慧體",
    mode_no_agent: "無智能代理",
    next: "下次",
    no_jobs_sync: "未擷取到定時任務。點擊立即同步從 state.db 回填。",
    no_jobs_window: "{window} 內無任務。上次同步：{time} UTC",
    no_schedule: "無排程",
    nominal_mo: "標稱/月",
    pace: "執行率",
    runs: "執行",
    schedule: "排程",
    see_runs: "查看執行",
    sort_by: "按 {col} 排序",
    sorted_by: "按 {col} {dir} 排序",
    title: "任務明細",
    trend_mo: "趨勢/月",
    using: "使用",
  },
  // job_detail
  job_detail: {
    duration: "耗時",
    error_prefix: "錯誤：",
    est_cost: "預估成本",
    for_full_history: " 查看完整歷程。",
    loading: "載入執行記錄...",
    mode: "模式",
    mode_agent: "智慧體",
    no_runs: "未找到執行記錄。",
    of: " / ",
    result: "結果",
    run: "次執行",
    runs_plural: "次執行",
    showing: "顯示 ",
    title_runs: "執行記錄",
    use_cli: "使用 ",
  },
  // leaderboard
  leaderboard: {
    most_efficient: "最佳執行率",
    of_total_est_cost: "佔預估總成本 %",
    of_total_runs: "佔總執行數 %",
    of_total_tokens: "佔總令牌數 %",
    title: "排行榜",
    top_duration: "最長時長",
    top_est_cost: "最高成本",
    top_runs: "最多執行",
    top_tokens: "Token 最多",
  },
  // modal
  modal: {
    close: "關閉",
  },
  // mode_toggle
  mode_toggle: {
    agent: "智能代理",
    all: "全部",
    label: "模式",
    no_agent: "無智能代理",
  },
  // model_breakdown
  model_breakdown: {
    and_more: "還有 {n} 個",
    est_cost: "預估成本",
    model: "模型",
    runs: "執行",
    title: "模型分布",
  },
  // outcome_toggle
  outcome_toggle: {
    all: "全部",
    failure: "失敗",
    label: "結果",
    success: "成功",
  },
  // pace
  pace: {
    nominal_formula: "標稱 = 計畫執行次數 × 每次平均成本",
    pace_formula: "執行率     = 趨勢 / 標稱",
    trend_formula: "趨勢 = 實際執行次數 × 每次平均成本",
    what_this_means: "執行率將你的實際支出趨勢與你在定時任務定義中設定的預算進行比較。它回答：‘按照這個速度，我是超支還是節約？’",
  },
  // runs
  runs: {
    trend_formula: "趨勢 % = ((目前執行數 − 上期執行數) / 上期執行數) × 100",
    trend_note: "正值 = 比上期執行更多。負值 = 比上期執行更少。",
    what_this_means: "所選視窗內記錄的定時任務執行總次數。每次執行都會觸發你的計畫任務——無論成功、失敗還是重試。",
  },
  // shared
  shared: {
    all_scaled_30d: "使用所選視窗折算為 30 天。",
    breakdown: "明細",
    color_guide: "顏色說明",
    green_under_budget: "綠色 (< 1.0×) — 低於預算，支出少於計畫。",
    hide: "隱藏",
    how_its_calculated: "如何計算",
    job_details: "任務詳情",
    loading: "載入中…",
    neutral_budget: "中性 (1.0–2.0×) — 正常範圍內，輕微波動。",
    prior_window_note: "上期對比視窗是將相同時長向後平移所得。",
    red_over_budget: "紅色 (> 2.0×) — 超出預算，支出多於計畫。",
    refresh: "重新整理",
    retry: "重試",
    show: "顯示",
    showing_window: "顯示 ",
    sync_now: "立即同步",
    synced_n_runs: "已同步 {n} 次執行",
    trend_calculation: "趨勢計算",
    what_this_means: "這是什麼意思",
    window_context: "視窗上下文",
  },
  // sparkline
  sparkline: {
    cost_bar: "— 成本（柱狀）· ",
    daily_cost: "每日預估成本",
    daily_runs: "每日執行",
    duration_line: "- - 時長",
    tokens_line: "— Token",
  },
  // summary
  summary: {
    actual: "實際",
    all_time: "全部時間",
    cached: "快取",
    cost: "成本",
    estimated: "預估",
    in: "輸入",
    job_runs: "任務執行",
    last_n_days: "最近 {n} 天",
    no_schedule: "無排程",
    nominal: "標稱",
    out: "輸出",
    pace: "執行率",
    period: "週期",
    tokens: "Token",
    trend: "趨勢",
    vs_prior: "對比上期",
    wasted: "浪費",
  },
  // tokens
  tokens: {
    what_this_means: "令牌是 LLM 使用的計量單位。輸入令牌是你的提示詞 + 上下文。輸出令牌是模型的回應。快取令牌來自具有相同前綴的重複提示詞（更便宜）。",
  },
});