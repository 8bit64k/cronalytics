import { registerCatalog } from "./index.js";

registerCatalog("es", {
  // cost
  cost: {
    trend_formula: "Tendencia % = ((costo presente − costo anterior) / costo anterior) × 100",
    what_this_means: "El costo estimado se calcula a partir del uso de tokens y el precio del modelo. El costo real puede diferir ligeramente según la granularidad de facturación del proveedor.",
  },
  // day_selector
  day_selector: {
    apply_custom: "Aplicar días personalizados",
    go: "Ir",
    label: "Días",
  },
  // error
  error: {
    message: "Algo salió mal. Por favor recarga o contacta soporte.",
    title: "Error de Cronalytics",
  },
  // hero
  hero: {
    collapse_tooltip: "Contraer banner principal",
    definition_1: "1. Análisis y observabilidad de cron jobs.",
    definition_2: "2. El panel de control para automatizaciones agentivas en Hermes.",
    expand_tooltip: "Expandir banner principal",
    noun: "(sustantivo)",
    pronunciation: "/ˈkrɒn.əˌlɪt.ɪks/",
    tagline: "Observar. Medir. Optimizar.",
    title: "CRONALYTICS",
  },
  // job_breakdown
  job_breakdown: {
    ascending: "ascendente",
    avg_est_cost: "Costo est. prom.",
    avg_time: "Dur. promedio",
    descending: "descendente",
    est_cost: "Costo Est.",
    job: "Trabajo",
    last: "Último",
    last_run: "Última ejecución",
    mode_agent: "Agente",
    mode_no_agent: "Sin agente",
    next: "Siguiente",
    no_jobs_sync: "No se capturaron cron jobs. Haz clic en Sincronizar ahora para rellenar desde state.db.",
    no_jobs_window: "Sin trabajos en {window}. Última sincronización: {time} UTC",
    no_schedule: "Sin prog.",
    nominal_mo: "Nominal/mes",
    pace: "Ritmo",
    runs: "Ejec.",
    schedule: "Programación",
    see_runs: "Ver ejecuciones",
    sort_by: "Ordenar por {col}",
    sorted_by: "Ordenado por {col}, {dir}",
    title: "Desglose de trabajos",
    trend_mo: "Tendencia/mes",
    using: "usando",
  },
  // job_detail
  job_detail: {
    duration: "Duración",
    error_prefix: "Error: ",
    est_cost: "Costo Est.",
    for_full_history: " para historial completo.",
    loading: "Cargando ejecuciones...",
    mode: "Modo",
    mode_agent: "Agente",
    no_runs: "No se encontraron ejecuciones.",
    of: " de ",
    result: "Resultado",
    run: "ejecución",
    runs_plural: "ejecuciones",
    showing: "Mostrando ",
    time: "Fecha",
    title_runs: "Ejecuciones",
    use_cli: "Usar ",
  },
  // leaderboard
  leaderboard: {
    most_efficient: "Mejor ritmo",
    of_total_est_cost: "% del costo total est.",
    of_total_runs: "% del total de ejec.",
    of_total_tokens: "% del total de tokens",
    title: "Tabla de líderes",
    top_duration: "Mayor duración",
    top_est_cost: "Mayor Costo",
    top_runs: "Más ejecuciones",
    top_tokens: "Más tokens",
  },
  // modal
  modal: {
    close: "Cerrar",
  },
  // mode_toggle
  mode_toggle: {
    agent: "Agente",
    all: "Todos",
    label: "Modo",
    no_agent: "Sin agente",
  },
  // model_breakdown
  model_breakdown: {
    and_more: "y {n} más",
    est_cost: "Costo Est.",
    model: "Modelo",
    runs: "Ejec.",
    title: "Desglose por modelo",
  },
  // outcome_toggle
  outcome_toggle: {
    all: "Todos",
    failure: "Fallo",
    label: "Resultados",
    success: "Éxito",
  },
  // pace
  pace: {
    nominal_formula: "Nominal = ejecuciones programadas × costo promedio por ejecución",
    pace_formula: "Ritmo = Tendencia / Nominal",
    trend_formula: "Tendencia = ejecuciones reales × costo promedio por ejecución",
    what_this_means: "El ritmo compara tu tendencia de gasto real contra el presupuesto que configuraste en tus cron jobs. Responde: ‘A este ritmo, ¿estoy por encima o por debajo del presupuesto?’",
  },
  // runs
  runs: {
    trend_formula: "Tendencia % = ((ejec. actuales − ejec. anteriores) / ejec. anteriores) × 100",
    trend_note: "Positivo = más ejecuciones que la ventana anterior. Negativo = menos ejecuciones.",
    what_this_means: "Número total de ejecuciones de cron jobs registradas en la ventana seleccionada. Cada ejecución activa tu tarea programada, ya sea exitosa, fallida o reintentada.",
  },
  // shared
  shared: {
    all_scaled_30d: "Todo escalado a un mes de 30 días usando la ventana seleccionada.",
    breakdown: "Desglose",
    color_guide: "Guía de colores",
    green_under_budget: "Verde (< 1.0×) — Por debajo del presupuesto. Gasto menor al programado.",
    hide: "Ocultar",
    how_its_calculated: "Cómo se calcula",
    job_details: "Detalles del trabajo",
    loading: "Cargando…",
    neutral_budget: "Neutral (1.0–2.0×) — En camino. Variación leve dentro del rango normal.",
    prior_window_note: "La ventana de comparación anterior tiene la misma duración desplazada en el tiempo.",
    red_over_budget: "Rojo (> 2.0×) — Sobre presupuesto. Gasto mayor al programado.",
    refresh: "Actualizar",
    retry: "Reintentar",
    show: "Mostrar",
    showing_window: "Mostrando ",
    sync_now: "Sincronizar ahora",
    synced_n_runs: "Sincronizadas {n} ejecuciones",
    trend_calculation: "Cálculo de tendencia",
    what_this_means: "Qué significa esto",
    window_context: "Contexto de ventana",
  },
  // sparkline
  sparkline: {
    cost_bar: "— costo (barra) · ",
    daily_cost: "Costo Est. Diario",
    daily_runs: "Ejecuciones diarias",
    duration_line: "- - duración",
    tokens_line: "— tokens",
  },
  // summary
  summary: {
    actual: "Real",
    all_time: "Todo el tiempo",
    cached: "En caché",
    cost: "Costo",
    estimated: "Estimado",
    in: "Entrada",
    job_runs: "Ejecuciones",
    last_n_days: "Últimos {n} días",
    no_schedule: "Sin programación",
    nominal: "Nominal",
    out: "Salida",
    pace: "Ritmo",
    period: "período",
    tokens: "Tokens",
    trend: "Tendencia",
    vs_prior: "vs anterior",
    wasted: "Desperdiciado",
  },
  // tokens
  tokens: {
    what_this_means: "Los tokens son la unidad de uso de los LLMs. Los tokens de entrada son tus prompts + contexto. Los tokens de salida son la respuesta del modelo. Los tokens en caché provienen de prompts repetidos con prefijos idénticos (más económicos).",
  },
});