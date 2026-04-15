export async function onRequestPost(context) {
  const body = await context.request.json();

  // If you bind D1 later, this will save real attempts.
  if (context.env.DB) {
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
    return Response.json({ ok: true, saved: "d1" });
  }

  return Response.json({ ok: true, saved: "noop" });
}
