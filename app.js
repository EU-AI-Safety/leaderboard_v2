const state = { data: null, activeTrack: "generative", metric: "macro_f1", analysisMetric: "macro_f1", resourceMetric: "macro_f1", breakdown: "by_language", query: "", guardTrack: "human_reviewed", guardDimension: "by_language", guardMetric: "macro_f1" };

const labels = {
  macro_f1: "Macro-F1",
  accuracy: "Accuracy",
  fcr: "FCR",
  frr: "FRR",
};

const annexProvisions = {
  "1(a)": "Remote biometric identification",
  "1(b)": "Sensitive biometric categorisation",
  "1(c)": "Emotion recognition",
  "2": "Critical infrastructure safety",
  "3(a)": "Education access & admission",
  "3(b)": "Learning outcome evaluation",
  "3(c)": "Education level placement",
  "3(d)": "Exam monitoring",
  "4(a)": "Recruitment & selection",
  "4(b)": "Worker management",
  "5(a)": "Public benefits & services",
  "5(b)": "Creditworthiness",
  "5(c)": "Life & health insurance",
  "5(d)": "Emergency response triage",
  "6(a)": "Crime victim risk",
  "6(b)": "Law-enforcement polygraphs",
  "6(c)": "Evidence reliability",
  "6(d)": "Offending risk assessment",
  "6(e)": "Criminal profiling",
  "7(a)": "Migration polygraphs",
  "7(b)": "Migration risk assessment",
  "7(c)": "Asylum & visa assessment",
  "7(d)": "Border detection",
  "8(a)": "Judicial assistance",
  "8(b)": "Elections & campaigns",
};

const pretty = (value) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const percent = (value) => `${(value * 100).toFixed(1)}`;

async function loadData() {
  const response = await fetch("data/leaderboard.json");
  if (!response.ok) throw new Error(`Could not load leaderboard data (${response.status})`);
  state.data = await response.json();
  initializeTrack();
  renderStats();
  populateModels();
  renderTable();
  renderGuardBenchmark();
  renderResourceChart();
  renderAnalysis();
  setActiveTrack(state.activeTrack, false);
}

function initializeTrack() {
  const requested = new URLSearchParams(window.location.search).get("track");
  const saved = localStorage.getItem("euguard-track");
  setActiveTrack(["generative", "guards"].includes(requested) ? requested : (["generative", "guards"].includes(saved) ? saved : "generative"), false);
}

function setActiveTrack(track, updateUrl = true) {
  state.activeTrack = track;
  document.body.dataset.activeTrack = track;
  document.querySelectorAll("[data-track]").forEach((button) => {
    const active = button.dataset.track === track;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-track-panel]").forEach((panel) => {
    const active = panel.dataset.trackPanel === track;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  document.querySelectorAll("[data-generative-nav]").forEach((link) => link.hidden = track !== "generative");
  const nav = document.getElementById("track-nav");
  const leaderboardLink = nav.querySelector("a:first-child");
  const analysisLink = [...nav.querySelectorAll("a")].find((link) => link.textContent === "Analysis");
  const methodologyLink = [...nav.querySelectorAll("a")].find((link) => link.textContent === "Methodology");
  leaderboardLink.textContent = track === "generative" ? "Leaderboard" : "Guard leaderboard";
  leaderboardLink.href = track === "generative" ? "#leaderboard" : "#guard-leaderboard";
  analysisLink.href = track === "generative" ? "#analysis" : "#guard-analysis";
  methodologyLink.href = track === "generative" ? "#methodology" : "#guard-methodology";
  document.getElementById("track-notice-text").textContent = track === "generative"
    ? "Generative LLMs produce full responses that are evaluated by an external refusal judge."
    : "Guard models classify prompts directly as allow or block; no response judge determines their decision.";
  localStorage.setItem("euguard-track", track);
  if (updateUrl) {
    const url = new URL(window.location);
    url.searchParams.set("track", track);
    history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function renderStats() {
  document.querySelectorAll("[data-stat]").forEach((element) => {
    const value = state.data.metadata[element.dataset.stat];
    element.textContent = typeof value === "number" ? value.toLocaleString() : value;
  });
  const metadata = state.data.metadata;
  document.getElementById("table-note").textContent =
    `Source: EU-Guard Generations ${metadata.release}. ${metadata.evaluated_items.toLocaleString()} scored items/model` +
    (metadata.coverage_gap ? `; ${metadata.coverage_gap} canonical items/model pending in this release.` : ". Full canonical coverage.") +
    (!metadata.shared_example_set ? ` ${metadata.shared_examples.toLocaleString()} examples are shared by every model; legacy provenance differences are retained.` : " All models share the same example set.") +
    " Lower is better for FCR and FRR.";
}

function sortedModels() {
  const ascending = state.metric === "fcr" || state.metric === "frr";
  return [...state.data.models]
    .filter((model) => `${model.name} ${model.organization} ${model.model_id}`.toLowerCase().includes(state.query))
    .sort((a, b) => ascending ? a.metrics[state.metric] - b.metrics[state.metric] : b.metrics[state.metric] - a.metrics[state.metric]);
}

function renderTable() {
  const models = sortedModels();
  const best = models.length ? models[0].metrics[state.metric] : null;
  document.querySelector(".metric-heading").textContent = labels[state.metric];
  document.getElementById("leaderboard-body").innerHTML = models.length ? models.map((model, index) => {
    const metric = model.metrics[state.metric];
    return `<tr>
      <td class="rank ${index < 3 ? "top" : ""}">${String(index + 1).padStart(2, "0")}</td>
      <td><span class="model-name">${model.name}</span><span class="model-org">${model.organization}</span></td>
      <td class="number">${model.parameters}</td>
      <td class="score-cell"><div class="score"><span class="number ${metric === best ? "metric-best" : ""}">${percent(metric)}</span><span class="score-bar"><i style="width:${metric * 100}%"></i></span></div></td>
      <td class="number">${percent(model.metrics.accuracy)}</td>
      <td class="number">${percent(model.metrics.fcr)}</td>
      <td class="number">${percent(model.metrics.frr)}</td>
      <td><button class="profile-button" data-profile="${model.slug}">Inspect →</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="8" class="loading">No models match that search.</td></tr>`;

  document.querySelectorAll("[data-profile]").forEach((button) => button.addEventListener("click", () => {
    document.getElementById("analysis-model").value = button.dataset.profile;
    renderAnalysis();
    document.getElementById("analysis").scrollIntoView({ behavior: "smooth" });
  }));
}

function guardTrack() {
  return state.data.guard_benchmark.tracks[state.guardTrack];
}

function populateGuardModels() {
  const select = document.getElementById("guard-model");
  const previous = select.value;
  select.innerHTML = guardTrack().models.map((model) => `<option value="${model.slug}">${model.name}</option>`).join("");
  if (guardTrack().models.some((model) => model.slug === previous)) select.value = previous;
}

function renderGuardBenchmark() {
  if (!state.data.guard_benchmark) {
    document.getElementById("guard-leaderboard").hidden = true;
    return;
  }
  const track = guardTrack();
  const primary = state.guardTrack === "human_reviewed";
  document.getElementById("guard-summary").innerHTML = `
    <div><strong>${track.models.length}</strong><span>Guard models</span></div>
    <div><strong>${track.items_per_model.toLocaleString()}</strong><span>Test items/model</span></div>
    <div><strong>${track.languages}</strong><span>Languages</span></div>
    <div><strong>${track.categories}</strong><span>Risk categories</span></div>
    <p><b>${primary ? "Primary track" : "Extended multilingual track"}</b>${primary ? "Accepted source and human-reviewed translations." : "Broad language coverage with machine-localized variants."}</p>`;
  document.getElementById("guard-leaderboard-body").innerHTML = track.models.map((model) => `
    <tr>
      <td class="rank ${model.rank <= 3 ? "top" : ""}">${String(model.rank).padStart(2, "0")}</td>
      <td><span class="model-name">${model.name}</span><span class="model-org">${model.organization} · ${model.native_policy_family}</span></td>
      <td class="number">${model.parameters}</td>
      <td class="number guard-primary-score">${percent(model.metrics.macro_f1)}</td>
      <td class="number">${model.metrics.mcc.toFixed(2)}</td>
      <td class="number">${percent(model.metrics.block_recall)}</td>
      <td class="number">${percent(model.metrics.over_block)}</td>
      <td class="number">${percent(model.metrics.under_block)}</td>
    </tr>`).join("");
  populateGuardModels();
  renderGuardBreakdown();
}

function guardProvisionLabel(key) {
  const parts = key.replace("EUAI.ANNEXIII.", "").split(".");
  return parts.length === 1 ? parts[0] : `${parts[0]}(${parts[1]})`;
}

function renderGuardBreakdown() {
  const slug = document.getElementById("guard-model").value || guardTrack().models[0].slug;
  const model = guardTrack().models.find((candidate) => candidate.slug === slug);
  const metric = state.guardMetric;
  const entries = Object.entries(model[state.guardDimension]).sort((a, b) => b[1][metric] - a[1][metric]);
  const lowerIsBetter = metric === "over_block" || metric === "under_block";
  document.getElementById("guard-breakdown-chart").innerHTML = entries.map(([key, metrics], index) => {
    const label = state.guardDimension === "by_provision"
      ? `<span class="annex-code">${guardProvisionLabel(key)}</span><span class="annex-name">${key}</span>`
      : key;
    return `<div class="bar-row ${lowerIsBetter ? "guard-error" : ""}" title="${key}: ${percent(metrics[metric])}; block=${metrics.n_should_block.toLocaleString()}, allow=${metrics.n_should_allow.toLocaleString()}">
      <span class="bar-label ${state.guardDimension === "by_provision" ? "annex-label" : ""}">${label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${metrics[metric] * 100}%;animation-delay:${Math.min(index * 18, 220)}ms"></span></span>
      <span class="bar-value">${percent(metrics[metric])}</span>
    </div>`;
  }).join("");
}

function populateModels() {
  const select = document.getElementById("analysis-model");
  select.innerHTML = state.data.models.map((model) => `<option value="${model.slug}">${model.name}</option>`).join("");
  const heatmapSelect = document.getElementById("heatmap-model");
  heatmapSelect.innerHTML = `<option value="overall">Overall · 17-model mean</option>` +
    state.data.models.map((model) => `<option value="${model.slug}">${model.name}</option>`).join("");
}

function renderAnalysis() {
  const slug = document.getElementById("analysis-model").value || state.data.models[0].slug;
  const model = state.data.models.find((candidate) => candidate.slug === slug);
  document.getElementById("model-card").innerHTML = `
    <div><span class="big-score">${percent(model.metrics.macro_f1)}</span><span class="card-label">Macro-F1 · rank ${model.rank} of ${state.data.models.length}</span></div>
    <dl>
      <div><dt>Accuracy</dt><dd>${percent(model.metrics.accuracy)}</dd></div>
      <div><dt>False compliance</dt><dd>${percent(model.metrics.fcr)}</dd></div>
      <div><dt>False refusal</dt><dd>${percent(model.metrics.frr)}</dd></div>
      <div><dt>Evaluated items</dt><dd>${model.metrics.n.toLocaleString()}</dd></div>
    </dl>`;
  const equity = model.language_equity;
  document.getElementById("equity-card").innerHTML = `
    <p class="equity-title">Language equity</p>
    <div class="equity-gap"><strong>${percent(equity.english_gap)}</strong><span>English advantage over non-English mean</span></div>
    <div class="equity-range"><span><b>${equity.best_language}</b>${percent(equity.best_macro_f1)}</span><i></i><span><b>${equity.worst_language}</b>${percent(equity.worst_macro_f1)}</span></div>
    <p>${percent(model.cross_language_consistency.pairwise_agreement)} mean pairwise response-label agreement across localized variants.</p>`;

  const metric = state.analysisMetric;
  const entries = Object.entries(model[state.breakdown]).sort((a, b) => b[1][metric] - a[1][metric]);
  const breakdownLabel = (key) => state.breakdown === "by_annex"
    ? `<span class="annex-code">${key}</span><span class="annex-name">${annexProvisions[key] || "Annex III use case"}</span>`
    : pretty(key);
  const tooltipLabel = (key) => state.breakdown === "by_annex"
    ? `Annex III ${key} · ${annexProvisions[key] || "High-risk AI use case"}`
    : key;
  document.getElementById("breakdown-chart").innerHTML = entries.map(([key, metrics], index) => `
    <div class="bar-row metric-${metric}" title="${tooltipLabel(key)}: ${percent(metrics[metric])} ${labels[metric]} across ${metrics.n.toLocaleString()} items${metric === "macro_f1" ? "" : "; lower is better"}">
      <span class="bar-label ${state.breakdown === "by_annex" ? "annex-label" : ""}">${breakdownLabel(key)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${metrics[metric] * 100}%; animation-delay:${Math.min(index * 18, 220)}ms"></span></span>
      <span class="bar-value">${percent(metrics[metric])}</span>
    </div>`).join("");
  renderHeatmap();
}

function renderHeatmap() {
  const selected = document.getElementById("heatmap-model").value || "overall";
  const sourceModels = selected === "overall"
    ? state.data.models
    : [state.data.models.find((model) => model.slug === selected)];
  const reference = sourceModels[0];
  const languages = Object.keys(reference.by_language);
  const categories = Object.keys(reference.by_category);
  const metric = state.analysisMetric;
  const shortLanguage = (language) => language.slice(0, 3).toUpperCase();
  const cells = [];
  cells.push(`<span class="heat-corner"></span>`);
  languages.forEach((language) => cells.push(`<span class="heat-col" title="${language}">${shortLanguage(language)}</span>`));
  categories.forEach((category) => {
    cells.push(`<span class="heat-row" title="${category}">${category}</span>`);
    languages.forEach((language) => {
      const modelValues = sourceModels.map((model) => model.by_category_language[`${category}|${language}`]);
      const values = modelValues[0];
      const value = modelValues.reduce((sum, item) => sum + item[metric], 0) / modelValues.length;
      const quality = metric === "macro_f1" ? value : 1 - value;
      const hue = 5 + quality * 125;
      const lightness = 43 + quality * 9;
      const scope = selected === "overall" ? "17-model mean" : sourceModels[0].name;
      cells.push(`<span class="heat-cell" style="background:hsl(${hue} 67% ${lightness}%)" title="${category} · ${language}\n${scope}\n${labels[metric]}: ${percent(value)}\nItems/model: ${values.n.toLocaleString()} · Should refuse: ${values.n_should_refuse.toLocaleString()} · Should answer: ${values.n_should_answer.toLocaleString()}"></span>`);
    });
  });
  const heatmap = document.getElementById("category-language-heatmap");
  heatmap.style.gridTemplateColumns = `190px repeat(${languages.length}, 25px)`;
  heatmap.innerHTML = cells.join("");
  document.getElementById("heatmap-metric").textContent = labels[metric];
}

function renderResourceChart() {
  const analysis = state.data.resource_analysis;
  const metric = state.resourceMetric;
  const stats = analysis.metrics[metric];
  const resources = Object.fromEntries(analysis.points.map((point) => [point.language, point.hplt_cleaned_words]));
  const models = state.data.models;
  const svg = document.getElementById("resource-chart");
  const width = 980, height = 520, left = 65, right = 25, top = 28, bottom = 52;
  const languages = Object.keys(resources);
  const xValues = languages.map((language) => Math.log10(resources[language]));
  const yValues = models.flatMap((model) => languages.map((language) => model.by_language[language][metric]));
  const xMin = Math.floor(Math.min(...xValues)), xMax = Math.ceil(Math.max(...xValues));
  const yMin = Math.max(0, Math.floor(Math.min(...yValues) * 10) / 10 - .05);
  const yMax = Math.min(1, Math.ceil(Math.max(...yValues) * 10) / 10 + .05);
  const x = (value) => left + (value - xMin) / (xMax - xMin) * (width - left - right);
  const y = (value) => top + (yMax - value) / (yMax - yMin) * (height - top - bottom);
  const palette = ["#2f7ebc", "#f08a32", "#55a868", "#c17cbe", "#e05a59", "#8c6d5a", "#63b6af", "#b9a233", "#9a7bc1", "#dd7ab4", "#7394c8", "#e59f6b", "#7cae71", "#b3b3b3", "#d46b6b", "#69a1d1", "#8b8b56"];
  const fit = (values, inputs = xValues) => {
    const xMean = inputs.reduce((sum, value) => sum + value, 0) / inputs.length;
    const yMean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const slope = inputs.reduce((sum, value, index) => sum + (value - xMean) * (values[index] - yMean), 0) / inputs.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
    const intercept = yMean - slope * xMean;
    const numerator = inputs.reduce((sum, value, index) => sum + (value - xMean) * (values[index] - yMean), 0);
    const denominator = Math.sqrt(inputs.reduce((sum, value) => sum + (value - xMean) ** 2, 0) * values.reduce((sum, value) => sum + (value - yMean) ** 2, 0));
    return { slope, intercept, correlation: numerator / denominator };
  };
  let markup = "";
  for (let tick = Math.ceil(yMin * 10) / 10; tick <= yMax + .001; tick += .1) markup += `<line class="chart-grid" x1="${left}" y1="${y(tick)}" x2="${width-right}" y2="${y(tick)}"/><text class="chart-tick" x="${left-10}" y="${y(tick)+4}" text-anchor="end">${(tick*100).toFixed(0)}</text>`;
  for (let tick = xMin; tick <= xMax; tick++) {
    markup += `<line class="chart-grid vertical" x1="${x(tick)}" y1="${top}" x2="${x(tick)}" y2="${height-bottom}"/><text class="chart-tick" x="${x(tick)}" y="${height-18}" text-anchor="middle">10^${tick}</text>`;
  }
  const legend = [];
  models.forEach((model, modelIndex) => {
    const color = palette[modelIndex];
    const values = languages.map((language) => model.by_language[language][metric]);
    const regression = fit(values);
    markup += `<line class="model-trend" style="stroke:${color}" x1="${x(xMin)}" y1="${y(regression.slope*xMin+regression.intercept)}" x2="${x(xMax)}" y2="${y(regression.slope*xMax+regression.intercept)}"/>`;
    languages.forEach((language, index) => {
      markup += `<circle class="model-resource-point" style="fill:${color}" cx="${x(xValues[index])}" cy="${y(values[index])}" r="3.8"><title>${model.name} · ${language}\nHPLT words: ${resources[language].toLocaleString()}\n${labels[metric]}: ${percent(values[index])}</title></circle>`;
    });
    legend.push(`<span><i style="background:${color}"></i>${model.name}<b>${regression.correlation >= 0 ? "+" : ""}${regression.correlation.toFixed(2)}</b></span>`);
  });
  const pooledInputs = models.flatMap(() => xValues);
  const pooledFit = fit(yValues, pooledInputs);
  markup += `<line class="pooled-trend" x1="${x(xMin)}" y1="${y(pooledFit.slope*xMin+pooledFit.intercept)}" x2="${x(xMax)}" y2="${y(pooledFit.slope*xMax+pooledFit.intercept)}"/>`;
  svg.innerHTML = markup;
  document.getElementById("resource-model-legend").innerHTML = legend.join("") + `<span class="pooled-key"><i></i>Pooled trend<b>${pooledFit.correlation >= 0 ? "+" : ""}${pooledFit.correlation.toFixed(2)}</b></span>`;
  document.getElementById("resource-correlation").textContent = `r = ${stats.pearson.toFixed(2)}`;
  document.getElementById("resource-interval").textContent = `95% CI [${stats.pearson_95ci[0].toFixed(2)}, ${stats.pearson_95ci[1].toFixed(2)}] · ρ = ${stats.spearman.toFixed(2)}`;
  const supported = stats.pearson_95ci[0] * stats.pearson_95ci[1] > 0;
  document.getElementById("resource-interpretation").textContent = metric === "macro_f1"
    ? "Higher language-resource availability is associated with higher macro-F1."
    : metric === "fcr"
      ? "Lower-resource languages are associated with higher false compliance."
      : supported ? "Resource availability is associated with false refusal." : "The false-refusal association is weaker and statistically uncertain.";
}

document.getElementById("model-search").addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  renderTable();
});

document.querySelectorAll("[data-metric]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-metric]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.metric = button.dataset.metric;
  renderTable();
}));

document.querySelectorAll("[data-breakdown]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-breakdown]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.breakdown = button.dataset.breakdown;
  renderAnalysis();
}));

document.querySelectorAll("[data-analysis-metric]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-analysis-metric]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.analysisMetric = button.dataset.analysisMetric;
  renderAnalysis();
}));

document.querySelectorAll("[data-resource-metric]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-resource-metric]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.resourceMetric = button.dataset.resourceMetric;
  renderResourceChart();
}));

document.getElementById("analysis-model").addEventListener("change", renderAnalysis);
document.getElementById("heatmap-model").addEventListener("change", renderHeatmap);

document.querySelectorAll("[data-guard-track]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-guard-track]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.guardTrack = button.dataset.guardTrack;
  renderGuardBenchmark();
}));

document.querySelectorAll("[data-guard-dimension]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-guard-dimension]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.guardDimension = button.dataset.guardDimension;
  renderGuardBreakdown();
}));

document.querySelectorAll("[data-guard-metric]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-guard-metric]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.guardMetric = button.dataset.guardMetric;
  renderGuardBreakdown();
}));

document.getElementById("guard-model").addEventListener("change", renderGuardBreakdown);

document.querySelectorAll("[data-track]").forEach((button) => button.addEventListener("click", () => setActiveTrack(button.dataset.track)));

loadData().catch((error) => {
  document.getElementById("leaderboard-body").innerHTML = `<tr><td colspan="8" class="loading">${error.message}. Serve this directory over HTTP to view the leaderboard.</td></tr>`;
  console.error(error);
});
