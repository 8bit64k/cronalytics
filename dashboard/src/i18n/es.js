/**
 * Cronalytics Spanish catalog — REVIEW NEEDED (Gaby).
 *
 * This is a first-pass machine + "passable Spanish" translation.
 * Native speaker review required before any release.
 */

import { registerCatalog } from "./index.js";

registerCatalog("es", {
  // HeroBanner — the greeting
  hero: {
    title: "CRONALYTICS",
    tagline: "Observa. Mide. Optimiza.",
    pronunciation: "/ˈkrɒn.əˌlɪt.ɪks/",
    noun: "(sustantivo)",
    definition_1: "1. An\u00e1lisis y observabilidad de cron.",
    definition_2: "2. El panel para automatizaciones agenticas en Hermes.",
    expand_tooltip: "Expandir banner principal",
    collapse_tooltip: "Colapsar banner principal",
  },

  // SummaryBoard — headline stats
  summary: {
    job_runs: "Ejecuciones",
    cost: "Costo",
    wasted: "Desperdiciado",
    tokens: "Tokens",
    cached: "En cach\u00e9",
    pace: "Ritmo",
    trend: "Tendencia",
    estimated: "Estimado",
    actual: "Real",
    all_time: "Todo el tiempo",
    last_n_days: "\u00daltimos {n} d\u00edas",
    vs_prior: "vs anterior",
    period: "periodo",
    nominal: "Nominal",
    in: "Entrada",
    out: "Salida",
    no_schedule: "Sin horario",
  },

  // LeaderBoard — top performers
  leaderboard: {
    title: "Tabla de l\u00edderes",
    top_est_cost: "Mayor Costo",
    top_runs: "M\u00e1s Ejecuciones",
    top_tokens: "M\u00e1s Tokens",
    top_duration: "M\u00e1s Tiempo",
    most_efficient: "M\u00e1s Eficiente",
    of_total_est_cost: "% del costo total",
    of_total_runs: "% del total de ejec.",
    of_total_tokens: "% del total de tokens",
  },

  // JobBreakdown — per-job table
  job_breakdown: {
    title: "Desglose de Trabajos",
    job: "Trabajo",
    runs: "Ejec.",
    avg_time: "Duración Prom.",
    est_cost: "Costo Est.",
    avg_est_cost: "Costo Est. Prom.",
    nominal_mo: "Nominal/mes",
    trend_mo: "Tendencia/mes",
    pace: "Ritmo",
    mode_agent: "Agente",
    mode_no_agent: "Sin agente",
    no_schedule: "Sin horario",
    last: "\u00daltimo",
    using: "usando",
    next: "Pr\u00f3ximo",
    see_runs: "Ver Ejecuciones",
    schedule: "Horario",
    last_run: "\u00daltima ejecuci\u00f3n",
    no_jobs_window: "No hay trabajos en {window}. \u00daltima sinc.: {time} UTC",
    no_jobs_sync: "No hay trabajos cron capturados. Haz clic en Sincronizar para importar desde state.db.",
    sorted_by: "Ordenado por {col}, {dir}",
    sort_by: "Ordenar por {col}",
    ascending: "ascendente",
    descending: "descendente",
  },

  // JobDetailView — individual run history
  job_detail: {
    title_runs: "Ejecuciones",
    mode: "Modo",
    mode_agent: "Agente",
    duration: "Duraci\u00f3n",
    est_cost: "Costo Est.",
    loading: "Cargando ejecuciones...",
    error_prefix: "Error: ",
    for_full_history: " para historial completo.",
    no_runs: "No se encontraron ejecuciones.",
    showing: "Mostrando ",
    of: " de ",
    runs_plural: "ejecuciones",
    use_cli: "Usa ",
    run: "ejecuci\u00f3n",
  },

  // ModelBreakdown — per-model stats
  model_breakdown: {
    title: "Desglose por Modelo",
    model: "Modelo",
    runs: "Ejec.",
    est_cost: "Costo Est.",
    and_more: "y {n} m\u00e1s",
  },

  // SparkLine — daily trends
  sparkline: {
    daily_cost: "Costo Est. Diario",
    daily_runs: "Ejecuciones Diarias",
    cost_bar: "\u2014 costo (barra) \u00b7 ",
    tokens_line: "\u2014 tokens",
    duration_line: "- - duraci\u00f3n",
  },

  // DaySelector — time window picker
  day_selector: {
    label: "D\u00edas",
    apply_custom: "Aplicar d\u00edas personalizados",
    go: "Ir",
  },

  // ModeToggle — agent/no_agent/all filter
  mode_toggle: {
    label: "Modo",
    all: "Todos",
    agent: "Agente",
    no_agent: "Sin Agente",
  },

  // OutcomeToggle — success/failure/all filter
  outcome_toggle: {
    label: "Resultados",
    all: "Todos",
    success: "\u00c9xito",
    failure: "Fallo",
  },

  // ErrorBoundary — crash handler
  error: {
    title: "Error de Cronalytics",
    message: "Algo sali\u00f3 mal. Por favor actualiza o contacta soporte.",
  },

  // Modal — popup dialog
  modal: {
    close: "Cerrar",
  },

  // Pace modal explainer
  pace: {
    what_this_means: "El Ritmo compara tu tendencia de gasto real contra el presupuesto definido en tus trabajos cron. Responde: \u2018A este ritmo, \u00bfestoy sobre o bajo presupuesto?\u2019",
    nominal_formula: "Nominal = ejecuciones programadas \u00d7 costo promedio por ejecuci\u00f3n",
    trend_formula: "Tendencia = ejecuciones reales \u00d7 costo promedio por ejecuci\u00f3n",
    pace_formula: "Ritmo = Tendencia / Nominal",
  },

  // Runs modal explainer
  runs: {
    what_this_means: "N\u00famero total de ejecuciones de trabajos cron registradas en la ventana seleccionada. Cada ejecuci\u00f3n activa tu tarea programada\u2014ya sea \u00e9xito, fallo o reintento.",
    trend_formula: "Tendencia % = ((ejec. actuales \u2212 ejec. anteriores) / ejec. anteriores) \u00d7 100",
    trend_note: "Positivo = m\u00e1s ejecuciones que la ventana anterior. Negativo = menos ejecuciones.",
  },

  // Cost modal explainer
  cost: {
    what_this_means: "El costo estimado se calcula a partir del uso de tokens y los precios del modelo. El costo real puede diferir ligeramente seg\u00fan la granularidad de facturaci\u00f3n del proveedor.",
    trend_formula: "Tendencia % = ((costo actual \u2212 costo anterior) / costo anterior) \u00d7 100",
  },

  // Tokens modal explainer
  tokens: {
    what_this_means: "Los tokens son la moneda del uso de LLM. Los tokens de entrada son tus indicaciones + contexto. Los tokens de salida son la respuesta del modelo. Los tokens en cach\u00e9 provienen de indicaciones repetidas con prefijos id\u00e9nticos (m\u00e1s baratos).",
  },

  // Shared / generic
  shared: {
    loading: "Cargando\u2026",
    retry: "Reintentar",
    show: "Mostrar",
    hide: "Ocultar",
    refresh: "Actualizar",
    sync_now: "Sincronizar",
    synced_n_runs: "Sincronizadas {n} ejecuciones",
    what_this_means: "Qu\u00e9 significa esto",
    how_its_calculated: "C\u00f3mo se calcula",
    trend_calculation: "C\u00e1lculo de tendencia",
    window_context: "Contexto de ventana",
    showing_window: "Mostrando ",
    prior_window_note: "La ventana de comparaci\u00f3n anterior tiene la misma duraci\u00f3n desplazada hacia atr\u00e1s en el tiempo.",
    job_details: "Detalles del trabajo",
    color_guide: "Gu\u00eda de colores",
    neutral_budget: "Neutral (1.0\u20132.0\u00d7) \u2014 En camino. Ligera variaci\u00f3n dentro del rango normal.",
    green_under_budget: "Verde (< 1.0\u00d7) \u2014 Bajo presupuesto. Gastando menos de lo programado.",
    red_over_budget: "Rojo (> 2.0\u00d7) \u2014 Sobre presupuesto. Gastando m\u00e1s de lo programado.",
    all_scaled_30d: "Todo escalado a un mes de 30 d\u00edas usando la ventana seleccionada.",
    breakdown: "Desglose",
  },
});
