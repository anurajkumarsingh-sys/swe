async function test() {
  const videoId = '5YDVJaItmaY';
  try {
    const res = await fetch(`https://youtubetranscript.com/?server_vid2=${videoId}`);
    const text = await res.text();
    console.log('youtubetranscript status:', res.status, 'length:', text.length);
    if (text.includes('<transcript>')) {
      console.log('Found XML transcript snippet:', text.slice(0, 300));
    }
  } catch (e) {
    console.log('Error:', e);
  }
}
test();
