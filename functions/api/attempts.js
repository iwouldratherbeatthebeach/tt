export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    await context.env.DB.prepare(`
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
    ).run();

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(`
      SELECT
        id,
        candidate_name,
        candidate_email,
        readiness_band,
        overall_percent,
        raw_correct,
        total_questions,
        answered_count,
        completed_at,
        created_at
      FROM attempts
      ORDER BY id DESC
      LIMIT 100
    `).all();

    return Response.json({ ok: true, results });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
