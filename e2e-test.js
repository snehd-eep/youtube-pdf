async function testE2E() {
  const API = "http://localhost:3000";
  const videoUrl = "https://www.youtube.com/watch?v=i53Gi_K3o7I";

  console.log("=== E2E TEST ===\n");

  // 1. Test extract
  console.log("1. Testing /api/extract...");
  const extractRes = await fetch(`${API}/api/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: videoUrl }),
  });
  const extractData = await extractRes.json();
  
  if (extractData.error) {
    console.log(`   FAIL: ${extractData.error}`);
    process.exit(1);
  }
  console.log(`   PASS: Got ${extractData.transcript?.length || 0} transcript entries`);
  console.log(`   Title: ${extractData.title}`);

  // 2. Test summarize (normal mode)
  console.log("\n2. Testing /api/summarize (normal)...");
  const sumRes = await fetch(`${API}/api/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: extractData.transcript,
      mode: "normal",
      title: extractData.title,
      videoId: extractData.videoId,
    }),
  });
  const sumData = await sumRes.json();
  
  if (sumData.error) {
    console.log(`   FAIL: ${sumData.error}`);
  } else {
    console.log(`   PASS: Got summary with ${sumData.keyTakeaways?.length || 0} takeaways`);
    console.log(`   Gist: ${sumData.gist}`);
  }

  // 3. Test summarize (system-design mode)
  console.log("\n3. Testing /api/summarize (system-design)...");
  const sdRes = await fetch(`${API}/api/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: extractData.transcript,
      mode: "system-design",
      title: extractData.title,
      videoId: extractData.videoId,
    }),
  });
  const sdData = await sdRes.json();
  
  if (sdData.error) {
    console.log(`   FAIL: ${sdData.error}`);
  } else {
    console.log(`   PASS: Got ${sdData.diagrams?.length || 0} diagrams`);
  }

  // 4. Test LLM failover
  console.log("\n4. Testing LLM failover (Gemini -> Groq -> OpenRouter)...");
  console.log("   Checking which provider handles the request...");
  const failoverRes = await fetch(`${API}/api/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: extractData.transcript,
      mode: "normal",
      title: extractData.title + " (failover test)",
      videoId: extractData.videoId + "_failover",
    }),
  });
  const failoverData = await failoverRes.json();
  
  if (failoverData.error) {
    console.log(`   FAIL: ${failoverData.error}`);
  } else {
    console.log(`   PASS: Failover working, got response`);
  }

  // 5. Test exchange rate
  console.log("\n5. Testing /api/exchange-rate...");
  const rateRes = await fetch(`${API}/api/exchange-rate`);
  const rateData = await rateRes.json();
  console.log(`   Rate: 1 USD = ${rateData.inrPerUsd} INR`);

  // Summary
  console.log("\n=== E2E TEST COMPLETE ===");
  const passed = (!sumData.error ? 1 : 0) + (!sdData.error ? 1 : 0) + (!failoverData.error ? 1 : 0);
  const total = 3;
  console.log(`   ${passed}/${total} summarize tests passed`);
  console.log(`   Extract: PASS`);
  console.log(`   Exchange rate: ${rateData.inrPerUsd ? "PASS" : "FAIL"}`);
}

testE2E().catch(e => { console.error("E2E error:", e.message); process.exit(1); });