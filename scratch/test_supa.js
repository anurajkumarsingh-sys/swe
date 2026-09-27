async function testSupa() {
  const k = 'sd_3fc6ba8a617e74824abfc75892546448';
  const res = await fetch('https://api.supadata.ai/v1/youtube/transcript?videoId=5YDVJaItmaY&text=false', {
    headers: { 'x-api-key': k }
  });
  const data = await res.json();
  console.log('Keys:', Object.keys(data));
  console.log('Content sample:', data.content?.slice(0, 5));
}
testSupa();
