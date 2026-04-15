export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    // 1) Save attempt first
    const insert = await context.env.DB.prepare(`
      INSERT INTO attempts (
        candidate_name,
        candidate_email,
        readiness_band,
        overall_percent,
        raw_correct,
        total_questions,
        answered_count,
        domain_scores_json,
        weak_areas_json,
        completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).bind(
      body.candidateName || null,
      body.candidateEmail || null,
      body.readinessBand || null,
      body.overallPercent || 0,
      body.rawCorrect || 0,
      body.total || 0,
      body.answered || 0,
      JSON.stringify(body.domainScores || []),
      JSON.stringify(body.weakAreas || []),
      body.completedAt || null
    ).first();

    const attemptId = insert?.id;
    if (!attemptId) {
      throw new Error("Failed to create attempt row");
    }

    // 2) Build report HTML
    const html = buildReportHtml(body);

    // 3) Generate PDF using Browser Rendering
    // This assumes you configured a Browser Rendering binding named BROWSER
    const browser = await context.env.BROWSER.launch();
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBytes = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in"
      }
    });

    await browser.close();

    // 4) Save PDF to R2
    const safeName = (body.candidateName || "candidate")
      .replace(/[^a-z0-9_-]+/gi, "_")
      .toLowerCase();

    const pdfKey = `reports/${attemptId}_${safeName}.pdf`;

    await context.env.REPORTS.put(pdfKey, pdfBytes, {
      httpMetadata: {
        contentType: "application/pdf"
      }
    });

    // 5) Save the PDF key back to D1
    await context.env.DB.prepare(`
      UPDATE attempts
      SET pdf_key = ?
      WHERE id = ?
    `).bind(pdfKey, attemptId).run();

    return Response.json({
      ok: true,
      attemptId,
      pdfKey
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

function buildReportHtml(result) {
  const domainRows = (result.domainScores || [])
    .map(d => `
      <tr>
        <td>${escapeHtml(prettyDomain(d.domain))}</td>
        <td>${d.weightedPercent}%</td>
        <td>${d.correct}/${d.total}</td>
        <td>${escapeHtml(d.status)}</td>
      </tr>
    `)
    .join("");

  const weakAreas = (result.weakAreas || []).length
    ? `<ul>${result.weakAreas.map(x => `
        <li><strong>${escapeHtml(prettyDomain(x.domain))}</strong> — ${escapeHtml(String(x.subcategory).replaceAll("_", " "))}: missed ${x.misses}/${x.total}</li>
      `).join("")}</ul>`
    : "<p>No major gaps detected.</p>";

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; margin: 32px; color: #111; }
        h1, h2 { margin-bottom: 8px; }
        .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 10px; border-bottom: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <h1>Architect Readiness Assessment Report</h1>

      <div class="card">
        <p><strong>Candidate:</strong> ${escapeHtml(result.candidateName || "Unnamed candidate")}</p>
        <p><strong>Email:</strong> ${escapeHtml(result.candidateEmail || "-")}</p>
        <p><strong>Completed:</strong> ${escapeHtml(result.completedAt || "-")}</p>
        <p><strong>Readiness band:</strong> ${escapeHtml(result.readinessBand || "-")}</p>
        <p><strong>Weighted score:</strong> ${result.overallPercent || 0}%</p>
        <p><strong>Raw score:</strong> ${result.rawCorrect || 0}/${result.total || 0}</p>
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
          <tbody>${domainRows}</tbody>
        </table>
      </div>

      <div class="card">
        <h2>Priority growth areas</h2>
        ${weakAreas}
      </div>
    </body>
  </html>`;
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
    splunk_design_judgment: "Splunk Design Judgment"
  };
  return map[domain] || domain;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
