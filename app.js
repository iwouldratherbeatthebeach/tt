#hi mom

const state = {
  questions: [],
  currentIndex: 0,
  answers: {},
  result: null,
  saveStatus: "Not saved",
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
  completedDate: document.getElementById("completedDate"),
  domainScores: document.getElementById("domainScores"),
  growthAreas: document.getElementById("growthAreas"),

  // Optional elements. Code checks for existence.
  loggedStatus: document.getElementById("loggedStatus"),
  downloadHtmlBtn: document.getElementById("downloadHtmlBtn"),
  printBtn: document.getElementById("printBtn"),
};

const LOCAL_PROGRESS_KEY = "architect_assessment_progress_v1";
const LOCAL_ATTEMPTS_KEY = "architect_assessment_attempts_v1";

async function init() {
  try {
    const res = await fetch("./questions.json");
    if (!res.ok) {
      throw new Error(`Failed to load questions.json: ${res.status}`);
    }

    state.questions = await res.json();

    if (!Array.isArray(state.questions) || state.questions.length === 0) {
      throw new Error("questions.json is empty or invalid");
    }

    restoreProgress();
    updateProgress();

    if (state.result) {
      renderResults();
    }
  } catch (err) {
    console.error(err);
    if (els.questionText) {
      els.welcomeCard?.classList.add("hidden");
      els.quizCard?.classList.remove("hidden");
      els.questionText.textContent = "Failed to load questions.";
      els.choicesWrap.innerHTML = `<p>Please confirm questions.json exists in the same folder as index.html.</p>`;
    }
  }
}

function startAssessment() {
  if (!state.questions.length) return;

  els.welcomeCard?.classList.add("hidden");
  els.resultsCard?.classList.add("hidden");
  els.quizCard?.classList.remove("hidden");

  if (state.currentIndex >= state.questions.length) {
    state.currentIndex = 0;
  }

  renderQuestion();
  saveProgress();
}

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  if (!q) return;

  els.domainPill.textContent = prettyDomain(q.domain);
  els.subcategoryPill.textContent = humanize(q.subcategory);
  els.difficultyPill.textContent = q.difficulty;
  els.weightPill.textContent = `Weight ${q.weight}`;
  els.questionText.textContent = q.question;
  els.choicesWrap.innerHTML = "";

  ["A", "B", "C", "D"].forEach((letter) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `choice ${state.answers[q.question_id] === letter ? "selected" : ""}`;
    btn.innerHTML = `
      <div class="choice-letter">${letter}</div>
      <div class="choice-copy">${escapeHtml(q[`option_${letter.toLowerCase()}`])}</div>
    `;

btn.addEventListener("click", () => {
  state.answers[q.question_id] = letter;
  saveProgress();
  updateProgress();

  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex += 1;
    renderQuestion();
  } else {
    computeResult();
  }
});

    els.choicesWrap.appendChild(btn);
  });

  els.prevBtn.disabled = state.currentIndex === 0;
  els.nextBtn.disabled = state.currentIndex >= state.questions.length - 1;

  updateProgress();
}

function nextQuestion() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex += 1;
    renderQuestion();
    saveProgress();
  }
}

function prevQuestion() {
  if (state.currentIndex > 0) {
    state.currentIndex -= 1;
    renderQuestion();
    saveProgress();
  }
}

function resetAssessment() {
  const confirmed = window.confirm("Reset this assessment and clear saved local progress?");
  if (!confirmed) return;

  state.currentIndex = 0;
  state.answers = {};
  state.result = null;
  state.saveStatus = "Not saved";

  localStorage.removeItem(LOCAL_PROGRESS_KEY);

  els.quizCard?.classList.add("hidden");
  els.resultsCard?.classList.add("hidden");
  els.welcomeCard?.classList.remove("hidden");

  if (els.loggedStatus) {
    els.loggedStatus.textContent = state.saveStatus;
  }

  updateProgress();
}

async function computeResult() {
  if (!state.questions.length) return;

  let rawCorrect = 0;
  let weightedEarned = 0;
  let weightedPossible = 0;

  const domainStats = {};
  const subStats = {};

  for (const q of state.questions) {
    const answer = state.answers[q.question_id];
    const isCorrect = answer === q.correct_answer;
    const weight = Number(q.weight || 1);

    weightedPossible += weight;

    if (isCorrect) {
      rawCorrect += 1;
      weightedEarned += weight;
    }

    if (!domainStats[q.domain]) {
      domainStats[q.domain] = {
        domain: q.domain,
        correct: 0,
        total: 0,
        earned: 0,
        possible: 0,
      };
    }

    domainStats[q.domain].total += 1;
    domainStats[q.domain].possible += weight;

    if (isCorrect) {
      domainStats[q.domain].correct += 1;
      domainStats[q.domain].earned += weight;
    }

    const subKey = `${q.domain}::${q.subcategory}`;
    if (!subStats[subKey]) {
      subStats[subKey] = {
        domain: q.domain,
        subcategory: q.subcategory,
        misses: 0,
        total: 0,
      };
    }

    subStats[subKey].total += 1;
    if (!isCorrect) {
      subStats[subKey].misses += 1;
    }
  }

  const domainScores = Object.values(domainStats)
    .map((d) => {
      const weightedPercent = d.possible ? round2((d.earned / d.possible) * 100) : 0;
      return {
        domain: d.domain,
        correct: d.correct,
        total: d.total,
        weightedPercent,
        rawPercent: d.total ? round2((d.correct / d.total) * 100) : 0,
        status: statusForPercent(weightedPercent),
      };
    })
    .sort((a, b) => a.weightedPercent - b.weightedPercent);

  const weakAreas = Object.values(subStats)
    .filter((x) => x.misses > 0)
    .sort((a, b) => {
      const aRate = a.total ? a.misses / a.total : 0;
      const bRate = b.total ? b.misses / b.total : 0;
      return bRate - aRate || b.misses - a.misses;
    })
    .slice(0, 8)
    .map((x) => ({
      domain: x.domain,
      subcategory: x.subcategory,
      misses: x.misses,
      total: x.total,
      missRate: x.total ? round2((x.misses / x.total) * 100) : 0,
    }));

  const overallPercent = weightedPossible
    ? round2((weightedEarned / weightedPossible) * 100)
    : 0;

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

  state.saveStatus = "Saved locally";
  saveAttemptLocally(state.result);
  saveProgress();
  renderResults();

  try {
    await saveResultToApi(state.result);
    state.saveStatus = "Saved to database";
  } catch (err) {
    console.error("API save failed:", err);
    state.saveStatus = "Saved locally only";
  }

  if (els.loggedStatus) {
    els.loggedStatus.textContent = state.saveStatus;
  }

  saveProgress();
}

function renderResults() {
  const r = state.result;
  if (!r) return;

  els.quizCard?.classList.add("hidden");
  els.welcomeCard?.classList.add("hidden");
  els.resultsCard?.classList.remove("hidden");

  els.readinessBand.textContent = r.readinessBand;
  els.resultSummary.textContent =
    `${r.candidateName} completed the assessment` +
    (r.candidateEmail ? ` (${r.candidateEmail})` : "") +
    ".";

  els.overallWeighted.textContent = `${r.overallPercent}%`;
  els.overallRaw.textContent = `${r.rawCorrect}/${r.total}`;
  els.overallAnswered.textContent = `${r.answered}`;
  els.completedDate.textContent = r.completedAt;

  if (els.loggedStatus) {
    els.loggedStatus.textContent = state.saveStatus;
  }

  els.domainScores.innerHTML = "";
  r.domainScores.forEach((d) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-head">
        <span>${prettyDomain(d.domain)}</span>
        <span>${d.weightedPercent}% (${d.correct}/${d.total})</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${d.weightedPercent}%"></div>
      </div>
    `;
    els.domainScores.appendChild(row);
  });

  els.growthAreas.innerHTML = r.weakAreas.length
    ? `<ul>${r.weakAreas
        .map(
          (x) =>
            `<li><strong>${prettyDomain(x.domain)}</strong> — ${humanize(x.subcategory)}: missed ${x.misses}/${x.total} (${x.missRate}%)</li>`
        )
        .join("")}</ul>`
    : "<p>No major gaps detected.</p>";
}

async function saveResultToApi(result) {
  const res = await fetch("/api/attempts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(result),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API save failed: ${res.status} ${text}`);
  }

  return res.json();
}

function saveProgress() {
  const payload = {
    currentIndex: state.currentIndex,
    answers: state.answers,
    result: state.result,
    saveStatus: state.saveStatus,
    candidateName: els.candidateName.value,
    candidateEmail: els.candidateEmail.value,
  };

  localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(payload));
}

function restoreProgress() {
  const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);

    state.currentIndex = Number.isInteger(saved.currentIndex) ? saved.currentIndex : 0;
    state.answers = saved.answers || {};
    state.result = saved.result || null;
    state.saveStatus = saved.saveStatus || "Saved locally";

    els.candidateName.value = saved.candidateName || "";
    els.candidateEmail.value = saved.candidateEmail || "";
  } catch (err) {
    console.error("Failed to restore progress:", err);
  }
}

function saveAttemptLocally(result) {
  let attempts = [];

  try {
    const raw = localStorage.getItem(LOCAL_ATTEMPTS_KEY);
    attempts = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(attempts)) attempts = [];
  } catch (err) {
    attempts = [];
  }

  attempts.unshift(result);
  localStorage.setItem(LOCAL_ATTEMPTS_KEY, JSON.stringify(attempts.slice(0, 50)));
}

function updateProgress() {
  const total = state.questions.length || 100;
  const answered = Object.keys(state.answers).length;
  const qNum = state.questions.length
    ? Math.min(state.currentIndex + 1, state.questions.length)
    : 0;

  els.progressText.textContent = state.questions.length
    ? `Question ${qNum} of ${total}`
    : "Loading questions";

  els.answeredText.textContent = `${answered} / ${total}`;
  els.progressFill.style.width = `${(answered / total) * 100}%`;
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
    splunk_operations_troubleshooting: "Splunk Ops / Troubleshooting",
    splunk_design_judgment: "Splunk Design Judgment",
  };

  return map[domain] || humanize(domain);
}

function humanize(value) {
  return String(value).replaceAll("_", " ");
}

function statusForPercent(score) {
  if (score >= 90) return "Strong";
  if (score >= 80) return "Ready";
  if (score >= 70) return "Developing";
  return "Needs work";
}

function readinessBand(score, domainScores) {
  const lowSplunk = domainScores.filter(
    (d) => d.domain.startsWith("splunk_") && d.weightedPercent < 65
  ).length;

  if (score < 70 || lowSplunk > 2) return "Not Ready";
  if (score < 80) return "Developing";
  if (score < 90) return "Near Ready";
  return "Ready";
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

function buildReportHtml() {
  if (!state.result) return "";

  const r = state.result;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Architect Assessment Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #111; }
    .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #ddd; }
    ul { padding-left: 18px; }
  </style>
</head>
<body>
  <h1>Architect Readiness Assessment Report</h1>

  <div class="card">
    <p><strong>Candidate:</strong> ${escapeHtml(r.candidateName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(r.candidateEmail || "-")}</p>
    <p><strong>Completed:</strong> ${escapeHtml(r.completedAt)}</p>
    <p><strong>Readiness band:</strong> ${escapeHtml(r.readinessBand)}</p>
    <p><strong>Weighted score:</strong> ${r.overallPercent}%</p>
    <p><strong>Raw score:</strong> ${r.rawCorrect}/${r.total}</p>
    <p><strong>Answered:</strong> ${r.answered}/${r.total}</p>
  </div>

  <div class="card">
    <h2>Domain scores</h2>
    <table>
      <thead>
        <tr>
          <th>Domain</th>
          <th>Weighted %</th>
          <th>Raw</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${r.domainScores
          .map(
            (d) => `
          <tr>
            <td>${escapeHtml(prettyDomain(d.domain))}</td>
            <td>${d.weightedPercent}%</td>
            <td>${d.correct}/${d.total}</td>
            <td>${escapeHtml(d.status)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>Priority growth areas</h2>
    ${
      r.weakAreas.length
        ? `<ul>${r.weakAreas
            .map(
              (x) =>
                `<li><strong>${escapeHtml(prettyDomain(x.domain))}</strong> — ${escapeHtml(
                  humanize(x.subcategory)
                )}: missed ${x.misses}/${x.total} (${x.missRate}%)</li>`
            )
            .join("")}</ul>`
        : "<p>No major gaps detected.</p>"
    }
  </div>
</body>
</html>`;
}

function downloadHtmlReport() {
  const html = buildReportHtml();
  if (!html) return;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (state.result.candidateName || "candidate").replace(/[^a-z0-9-_]+/gi, "_");
  a.href = url;
  a.download = `${safeName}_architect_assessment_report.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function printReport() {
  const html = buildReportHtml();
  if (!html) return;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

els.startBtn?.addEventListener("click", startAssessment);
els.prevBtn?.addEventListener("click", prevQuestion);
els.nextBtn?.addEventListener("click", nextQuestion);
els.submitBtn?.addEventListener("click", computeResult);
els.resetBtn?.addEventListener("click", resetAssessment);
els.downloadHtmlBtn?.addEventListener("click", downloadHtmlReport);
els.printBtn?.addEventListener("click", printReport);

init();
