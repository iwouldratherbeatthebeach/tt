
const state = {
  questions: [],
  currentIndex: 0,
  answers: {},
  result: null,
  loggedStatus: "Local only",
};

const els = {
  candidateName: document.getElementById("candidateName"),
  candidateEmail: document.getElementById("candidateEmail"),
  progressText: document.getElementById("progressText"),
  answeredText: document.getElementById("answeredText"),
  progressFill: document.getElementById("progressFill"),
  startBtn: document.getElementById("startBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  submitBtn: document.getElementById("submitBtn"),
  resetBtn: document.getElementById("resetBtn"),
  welcomeCard: document.getElementById("welcomeCard"),
  quizCard: document.getElementById("quizCard"),
  resultsCard: document.getElementById("resultsCard"),
  domainPill: document.getElementById("domainPill"),
  subcategoryPill: document.getElementById("subcategoryPill"),
  difficultyPill: document.getElementById("difficultyPill"),
  weightPill: document.getElementById("weightPill"),
  questionText: document.getElementById("questionText"),
  choicesWrap: document.getElementById("choicesWrap"),
  readinessBand: document.getElementById("readinessBand"),
  resultSummary: document.getElementById("resultSummary"),
  overallWeighted: document.getElementById("overallWeighted"),
  overallRaw: document.getElementById("overallRaw"),
  overallAnswered: document.getElementById("overallAnswered"),
  loggedStatus: document.getElementById("loggedStatus"),
  domainScores: document.getElementById("domainScores"),
  growthAreas: document.getElementById("growthAreas"),
  domainTable: document.getElementById("domainTable"),
  downloadHtmlBtn: document.getElementById("downloadHtmlBtn"),
  printBtn: document.getElementById("printBtn"),
};

async function init() {
  const res = await fetch("./questions.json");
  state.questions = await res.json();
  restoreLocalProgress();
  updateProgress();
}

function saveLocalProgress() {
  const payload = {
    answers: state.answers,
    currentIndex: state.currentIndex,
    candidateName: els.candidateName.value,
    candidateEmail: els.candidateEmail.value,
    result: state.result,
    loggedStatus: state.loggedStatus,
  };
  localStorage.setItem("architect_assessment_pretty", JSON.stringify(payload));
}

function restoreLocalProgress() {
  const raw = localStorage.getItem("architect_assessment_pretty");
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    state.answers = saved.answers || {};
    state.currentIndex = saved.currentIndex || 0;
    state.result = saved.result || null;
    state.loggedStatus = saved.loggedStatus || "Local only";
    els.candidateName.value = saved.candidateName || "";
    els.candidateEmail.value = saved.candidateEmail || "";
    if (state.result) renderResults();
  } catch (e) {}
}

function startAssessment() {
  els.welcomeCard.classList.add("hidden");
  els.resultsCard.classList.add("hidden");
  els.quizCard.classList.remove("hidden");
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  els.domainPill.textContent = prettyDomain(q.domain);
  els.subcategoryPill.textContent = q.subcategory.replaceAll("_", " ");
  els.difficultyPill.textContent = q.difficulty;
  els.weightPill.textContent = `weight ${q.weight}`;
  els.questionText.textContent = q.question;
  els.choicesWrap.innerHTML = "";

  ["A","B","C","D"].forEach(letter => {
    const choice = document.createElement("button");
    choice.className = `choice ${state.answers[q.question_id] === letter ? "selected" : ""}`;
    choice.innerHTML = `
      <div class="choice-letter">${letter}</div>
      <div>${escapeHtml(q[`option_${letter.toLowerCase()}`])}</div>
    `;
    choice.addEventListener("click", () => {
      state.answers[q.question_id] = letter;
      saveLocalProgress();
      renderQuestion();
      updateProgress();
    });
    els.choicesWrap.appendChild(choice);
  });

  els.prevBtn.disabled = state.currentIndex === 0;
  els.nextBtn.disabled = state.currentIndex >= state.questions.length - 1;
  updateProgress();
}

function updateProgress() {
  const total = state.questions.length;
  const answered = Object.keys(state.answers).length;
  els.progressText.textContent = total ? `Question ${Math.min(state.currentIndex + 1, total)} of ${total}` : "Not started";
  els.answeredText.textContent = `${answered} / ${total}`;
  els.progressFill.style.width = `${(answered / total) * 100}%`;
}

function nextQuestion() {
  state.currentIndex = Math.min(state.currentIndex + 1, state.questions.length - 1);
  renderQuestion();
  saveLocalProgress();
}

function prevQuestion() {
  state.currentIndex = Math.max(state.currentIndex - 1, 0);
  renderQuestion();
  saveLocalProgress();
}

function resetAssessment() {
  if (!confirm("Reset local progress for this assessment?")) return;
  state.answers = {};
  state.currentIndex = 0;
  state.result = null;
  state.loggedStatus = "Local only";
  localStorage.removeItem("architect_assessment_pretty");
  els.resultsCard.classList.add("hidden");
  els.quizCard.classList.add("hidden");
  els.welcomeCard.classList.remove("hidden");
  updateProgress();
}

function computeResult() {
  let rawCorrect = 0;
  let weightedEarned = 0;
  let weightedPossible = 0;
  const domainStats = {};
  const subStats = {};

  state.questions.forEach(q => {
    const answer = state.answers[q.question_id];
    const correct = answer === q.correct_answer;
    const weight = Number(q.weight);

    weightedPossible += weight;
    if (correct) {
      rawCorrect += 1;
      weightedEarned += weight;
    }

    domainStats[q.domain] ||= { domain: q.domain, correct: 0, total: 0, earned: 0, possible: 0 };
    domainStats[q.domain].total += 1;
    domainStats[q.domain].possible += weight;
    if (correct) {
      domainStats[q.domain].correct += 1;
      domainStats[q.domain].earned += weight;
    }

    const subKey = `${q.domain}::${q.subcategory}`;
    subStats[subKey] ||= { domain: q.domain, subcategory: q.subcategory, misses: 0, total: 0 };
    subStats[subKey].total += 1;
    if (!correct) subStats[subKey].misses += 1;
  });

  const domainScores = Object.values(domainStats).map(d => ({
    domain: d.domain,
    correct: d.correct,
    total: d.total,
    weightedPercent: round2((d.earned / d.possible) * 100),
    rawPercent: round2((d.correct / d.total) * 100),
    status: statusForPercent((d.earned / d.possible) * 100),
  })).sort((a,b) => a.weightedPercent - b.weightedPercent);

  const weakAreas = Object.values(subStats)
    .filter(x => x.misses > 0)
    .sort((a,b) => (b.misses / b.total) - (a.misses / a.total))
    .slice(0, 8)
    .map(x => ({
      domain: x.domain,
      subcategory: x.subcategory,
      misses: x.misses,
      total: x.total,
      missRate: round2((x.misses / x.total) * 100),
    }));

  const overallPercent = round2((weightedEarned / weightedPossible) * 100);

  state.result = {
    candidateName: els.candidateName.value.trim() || "Unnamed candidate",
    candidateEmail: els.candidateEmail.value.trim(),
    rawCorrect,
    total: state.questions.length,
    answered: Object.keys(state.answers).length,
    weightedEarned: round2(weightedEarned),
    weightedPossible: round2(weightedPossible),
    overallPercent,
    readinessBand: readinessBand(overallPercent, domainScores),
    domainScores,
    weakAreas,
    completedAt: new Date().toLocaleString(),
  };

  saveLocalAttemptToHistory(state.result);
  saveLocalProgress();
  renderResults();
  postAttemptIfAvailable(state.result);
}

function saveLocalAttemptToHistory(result) {
  const raw = localStorage.getItem("architect_assessment_attempts");
  let attempts = [];
  try { attempts = raw ? JSON.parse(raw) : []; } catch(e) {}
  attempts.unshift(result);
  localStorage.setItem("architect_assessment_attempts", JSON.stringify(attempts.slice(0, 50)));
}

async function postAttemptIfAvailable(result) {
  try {
    const res = await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    if (res.ok) {
      state.loggedStatus = "Saved locally + API";
    } else {
      state.loggedStatus = "Saved locally";
    }
  } catch (e) {
    state.loggedStatus = "Saved locally";
  }
  els.loggedStatus.textContent = state.loggedStatus;
  saveLocalProgress();
}

function renderResults() {
  const r = state.result;
  els.quizCard.classList.add("hidden");
  els.welcomeCard.classList.add("hidden");
  els.resultsCard.classList.remove("hidden");

  els.readinessBand.textContent = r.readinessBand;
  els.resultSummary.textContent = `${r.candidateName} completed the assessment on ${r.completedAt}.`;
  els.overallWeighted.textContent = `${r.overallPercent}%`;
  els.overallRaw.textContent = `${r.rawCorrect}/${r.total}`;
  els.overallAnswered.textContent = `${r.answered}`;
  els.loggedStatus.textContent = state.loggedStatus;

  els.domainScores.innerHTML = "";
  r.domainScores.forEach(d => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-head">
        <span>${prettyDomain(d.domain)}</span>
        <span>${d.weightedPercent}% (${d.correct}/${d.total})</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${d.weightedPercent}%"></div></div>
    `;
    els.domainScores.appendChild(row);
  });

  els.growthAreas.innerHTML = r.weakAreas.length
    ? `<ul>${r.weakAreas.map(x => `<li><strong>${prettyDomain(x.domain)}</strong> — ${x.subcategory.replaceAll("_"," ")}: missed ${x.misses}/${x.total} (${x.missRate}%)</li>`).join("")}</ul>`
    : "<p>No major gaps detected.</p>";

  els.domainTable.innerHTML = `
    <table class="table">
      <thead>
        <tr><th>Domain</th><th>Weighted %</th><th>Raw</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${r.domainScores.map(d => `
          <tr>
            <td>${prettyDomain(d.domain)}</td>
            <td>${d.weightedPercent}%</td>
            <td>${d.correct}/${d.total}</td>
            <td>${d.status}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function buildReportHtml() {
  const r = state.result;
  return `<!doctype html>
  <html><head><meta charset="utf-8"><title>Assessment Report</title>
  <style>
    body{font-family:Arial,sans-serif;margin:32px;color:#111}
    .card{border:1px solid #ddd;border-radius:12px;padding:16px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse}
    th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}
  </style></head><body>
    <h1>Architect Readiness Assessment Report</h1>
    <div class="card">
      <p><strong>Candidate:</strong> ${escapeHtml(r.candidateName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(r.candidateEmail || "-")}</p>
      <p><strong>Completed:</strong> ${escapeHtml(r.completedAt)}</p>
      <p><strong>Band:</strong> ${escapeHtml(r.readinessBand)}</p>
      <p><strong>Weighted score:</strong> ${r.overallPercent}%</p>
      <p><strong>Raw score:</strong> ${r.rawCorrect}/${r.total}</p>
    </div>
    <div class="card">
      <h2>Scores by domain</h2>
      <table>
        <thead><tr><th>Domain</th><th>Weighted %</th><th>Raw</th><th>Status</th></tr></thead>
        <tbody>
          ${r.domainScores.map(d => `<tr><td>${prettyDomain(d.domain)}</td><td>${d.weightedPercent}%</td><td>${d.correct}/${d.total}</td><td>${d.status}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div class="card">
      <h2>Priority growth areas</h2>
      ${r.weakAreas.length ? `<ul>${r.weakAreas.map(x => `<li>${prettyDomain(x.domain)} — ${x.subcategory.replaceAll("_"," ")}: missed ${x.misses}/${x.total}</li>`).join("")}</ul>` : "<p>No major gaps detected.</p>"}
    </div>
  </body></html>`;
}

function downloadHtmlReport() {
  const blob = new Blob([buildReportHtml()], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (state.result.candidateName || "candidate").replace(/[^a-z0-9-_]+/gi, "_");
  a.href = url;
  a.download = `${safeName}_assessment_report.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function statusForPercent(score) {
  if (score >= 90) return "Strong";
  if (score >= 80) return "Ready";
  if (score >= 70) return "Developing";
  return "Needs work";
}

function readinessBand(score, domainScores) {
  const lowSplunk = domainScores.filter(d => d.domain.startsWith("splunk_") && d.weightedPercent < 65).length;
  if (score < 70 || lowSplunk > 2) return "Not Ready";
  if (score < 80) return "Developing";
  if (score < 90) return "Near Ready";
  return "Ready";
}

function prettyDomain(domain) {
  const map = {
    linux: "Linux",
    windows: "Windows",
    networking: "Networking",
    identity_pki: "Identity / PKI",
    splunk_data_ingest: "Splunk Data Ingest",
    splunk_search_architecture: "Splunk Search Architecture",
    splunk_auth_security: "Splunk Auth / Security",
    splunk_clustering_scaling: "Splunk Clustering / Scaling",
  };
  return map[domain] || domain.replaceAll("_", " ");
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.startBtn.addEventListener("click", startAssessment);
els.prevBtn.addEventListener("click", prevQuestion);
els.nextBtn.addEventListener("click", nextQuestion);
els.submitBtn.addEventListener("click", computeResult);
els.resetBtn.addEventListener("click", resetAssessment);
els.downloadHtmlBtn.addEventListener("click", downloadHtmlReport);
els.printBtn.addEventListener("click", () => {
  const win = window.open("", "_blank");
  win.document.write(buildReportHtml());
  win.document.close();
  win.focus();
  win.print();
});

init();
