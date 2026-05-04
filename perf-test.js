const fs = require("fs");
const path = require("path");
const videos = require("./perf-test-videos.json");
const API_BASE = process.env.API_BASE || "http://localhost:3000";
const PDF_DIR = path.join(process.cwd(), "test-pdfs");

if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

const results = { total: 0, success: 0, failed: 0, errors: {}, startTime: null, endTime: null, requests: [] };

async function testVideo(video, index) {
  const startTime = Date.now();
  const { videoId, mode, title } = video;
  const tag = `${videoId}(${mode})`;

  try {
    const extractRes = await fetch(`${API_BASE}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `https://youtube.com/watch?v=${videoId}` }),
    });
    const extractData = await extractRes.json();

    if (extractData.error) {
      const key = "EXTRACT_" + (extractData.error.substring(0, 25) || "ERROR");
      results.errors[key] = (results.errors[key] || 0) + 1;
      results.failed++;
      results.requests.push({ videoId, mode, success: false, step: "extract", error: extractData.error, time: Date.now() - startTime });
      console.log(`[${index + 1}/${videos.length}] ❌ ${tag} extract: ${extractData.error.substring(0, 50)}`);
      return;
    }

    if (!extractData.transcript || extractData.transcript.length === 0) {
      results.errors["NO_TRANSCRIPT"] = (results.errors["NO_TRANSCRIPT"] || 0) + 1;
      results.failed++;
      results.requests.push({ videoId, mode, success: false, step: "extract", error: "No transcript", time: Date.now() - startTime });
      console.log(`[${index + 1}/${videos.length}] ❌ ${tag} no transcript`);
      return;
    }

    const transcriptLen = extractData.transcript.length;
    const transcriptChars = extractData.transcript.reduce((sum, e) => sum + (e.text?.length || 0), 0);

    const sumRes = await fetch(`${API_BASE}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: extractData.transcript, mode, title: extractData.title || title, videoId }),
    });
    const sumData = await sumRes.json();

    if (sumData.error) {
      const key = "SUMMARIZE_" + (sumData.error.substring(0, 25) || "ERROR");
      results.errors[key] = (results.errors[key] || 0) + 1;
      results.failed++;
      results.requests.push({ videoId, mode, success: false, step: "summarize", error: sumData.error, time: Date.now() - startTime });
      console.log(`[${index + 1}/${videos.length}] ❌ ${tag} summarize: ${sumData.error.substring(0, 60)}`);
      return;
    }

    const pdfRes = await fetch(`${API_BASE}/api/generate-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: sumData,
        mode,
        videoId,
        title: extractData.title || title,
        ...(mode === "pro" || mode === "system-design-pro" ? { transcript: extractData.transcript } : {}),
      }),
    });

    if (!pdfRes.ok) {
      const errData = await pdfRes.json().catch(() => ({ error: "PDF generation failed" }));
      results.errors["PDF_" + (errData.error?.substring(0, 25) || "ERROR")] = (results.errors["PDF_" + (errData.error?.substring(0, 25) || "ERROR")] || 0) + 1;
      results.failed++;
      results.requests.push({ videoId, mode, success: false, step: "pdf", error: errData.error, time: Date.now() - startTime });
      console.log(`[${index + 1}/${videos.length}] ❌ ${tag} pdf: ${errData.error?.substring(0, 50)}`);
      return;
    }

    const pdfBuffer = await pdfRes.arrayBuffer();
    const filename = `${videoId}-${mode}.pdf`;
    const filepath = path.join(PDF_DIR, filename);
    fs.writeFileSync(filepath, Buffer.from(pdfBuffer));

    const totalTime = Date.now() - startTime;
    results.success++;
    results.requests.push({ videoId, mode, success: true, time: totalTime, takeaways: sumData.keyTakeaways?.length || 0, pdfSize: pdfBuffer.byteLength, pdfFile: filename, transcriptLen, transcriptChars, duration: video.duration || "unknown" });
    console.log(`[${index + 1}/${videos.length}] ✅ ${tag} ${totalTime}ms PDF=${(pdfBuffer.byteLength / 1024).toFixed(1)}KB`);
  } catch (err) {
    const key = "FETCH_" + (err.message?.substring(0, 25) || "UNKNOWN");
    results.errors[key] = (results.errors[key] || 0) + 1;
    results.failed++;
    results.requests.push({ videoId, mode, success: false, step: "fetch", error: err.message, time: Date.now() - startTime });
    console.log(`[${index + 1}/${videos.length}] ❌ ${tag} fetch: ${err.message?.substring(0, 50)}`);
  }
}

async function runTests() {
  results.startTime = Date.now();
  console.log(`\n🚀 FULL PERF TEST — ${videos.length} requests, ALL AT ONCE`);
  console.log(`📂 PDFs saved to: ${PDF_DIR}\n`);

  await Promise.all(videos.map((v, i) => testVideo(v, i)));
  results.total = videos.length;
  results.endTime = Date.now();
  printSummary();
}

function printSummary() {
  const totalTime = results.endTime - results.startTime;
  const totalTimeSec = totalTime / 1000;
  const successRate = results.total > 0 ? ((results.success / results.total) * 100).toFixed(1) : "0";
  const successfulTimes = results.requests.filter(r => r.success).map(r => r.time);
  const avgTime = successfulTimes.length > 0 ? Math.round(successfulTimes.reduce((a, b) => a + b, 0) / successfulTimes.length) : 0;
  const minTime = successfulTimes.length > 0 ? Math.min(...successfulTimes) : 0;
  const maxTime = successfulTimes.length > 0 ? Math.max(...successfulTimes) : 0;
  const rpm = totalTimeSec > 0 ? Math.round((results.success / totalTimeSec) * 60) : 0;
  const throughput = totalTimeSec > 0 ? Math.round((results.total / totalTimeSec) * 60) : 0;
  const totalPdfSize = results.requests.filter(r => r.success).reduce((a, b) => a + (b.pdfSize || 0), 0);
  const modeBreakdown = {};
  results.requests.forEach(r => {
    if (!modeBreakdown[r.mode]) modeBreakdown[r.mode] = { success: 0, failed: 0 };
    if (r.success) modeBreakdown[r.mode].success++;
    else modeBreakdown[r.mode].failed++;
  });

  console.log(`\n${"=".repeat(65)}`);
  console.log(`📊 FULL PERF TEST SUMMARY`);
  console.log(`${"=".repeat(65)}`);
  console.log(`Total: ${results.total} | ✅ ${results.success} (${successRate}%) | ❌ ${results.failed}`);
  console.log(`Time: ${totalTimeSec.toFixed(1)}s`);
  console.log(`Response: avg ${avgTime}ms | min ${minTime}ms | max ${maxTime}ms`);
  console.log(`RPM: ${rpm} successful | Throughput: ${throughput} total/min`);
  console.log(`Total PDF size: ${(totalPdfSize / 1024 / 1024).toFixed(2)} MB`);

  const successfulReqs = results.requests.filter(r => r.success);
  const transcriptStats = successfulReqs.map(r => ({ videoId: r.videoId, mode: r.mode, duration: r.duration, transcriptLen: r.transcriptLen, transcriptChars: r.transcriptChars, time: r.time, pdfSize: r.pdfSize }));
  const maxChars = Math.max(...successfulReqs.map(r => r.transcriptChars || 0));
  const minChars = Math.min(...successfulReqs.map(r => r.transcriptChars || 0));
  const avgChars = successfulReqs.length > 0 ? Math.round(successfulReqs.reduce((a, b) => a + (b.transcriptChars || 0), 0) / successfulReqs.length) : 0;
  console.log(`\nTranscript size: min ${minChars} chars | avg ${avgChars} chars | max ${maxChars} chars`);

  const failedReqs = results.requests.filter(r => !r.success);
  if (failedReqs.length > 0) {
    console.log(`\nFailed requests detail:`);
    failedReqs.forEach(r => console.log(`  ${r.videoId}(${r.mode}) [${r.duration || "?"}] step=${r.step} error=${(r.error || "").substring(0, 80)}`));
  }

  console.log(`\nBy mode:`);
  for (const [mode, counts] of Object.entries(modeBreakdown)) {
    console.log(`  ${mode}: ${counts.success}✅ / ${counts.failed}❌`);
  }
  if (Object.keys(results.errors).length > 0) {
    console.log(`\nErrors:`);
    for (const [error, count] of Object.entries(results.errors)) {
      console.log(`  ${error}: ${count}`);
    }
  }
  console.log(`\nPDFs saved in: ${PDF_DIR}`);
  console.log(`${"=".repeat(65)}`);

  fs.writeFileSync("./perf-test-results.json", JSON.stringify({
    timestamp: new Date().toISOString(),
    config: { apiBase: API_BASE, concurrent: "ALL", videoCount: videos.length },
    summary: { total: results.total, success: results.success, failed: results.failed, successRate, totalTimeMs: totalTime, avgResponseTimeMs: avgTime, minResponseTimeMs: minTime, maxResponseTimeMs: maxTime, successfulRpm: rpm, throughputRpm: throughput, modeBreakdown, totalPdfSizeMB: (totalPdfSize / 1024 / 1024).toFixed(2), transcriptStats: { minChars, maxChars, avgChars } },
    errors: results.errors,
    requests: results.requests,
  }, null, 2));
  console.log(`📄 Results saved to perf-test-results.json`);
}

runTests().catch(console.error);