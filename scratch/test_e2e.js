async function testEndToEnd() {
  console.log('1. Fetching transcript via /api/load-video...');
  const loadRes = await fetch('http://localhost:3000/api/load-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId: '5YDVJaItmaY' })
  });
  const loadData = await loadRes.json();
  console.log('Transcript source:', loadData.source, 'count:', loadData.transcript?.length);
  console.log('First 3 segments with timestamps:', loadData.transcript?.slice(0, 3));

  console.log('\n2. Testing Quiz generation with video progress at 30 seconds...');
  const firstSegments = loadData.transcript?.slice(0, 8) || [];
  const contextText = firstSegments.map(e => e.text).join(' ');
  console.log('Context sent to Gemini:', contextText);

  const quizRes = await fetch('http://localhost:3000/api/generate-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: contextText, language: 'en' })
  });
  const quizData = await quizRes.json();
  console.log('\nGenerated Quiz from Gemini:');
  console.log(JSON.stringify(quizData, null, 2));
}
testEndToEnd();
