export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  const { url, quality = '1080', audioOnly = false } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'Please paste a valid video URL first.' });
  }

  const trimmedUrl = url.trim();
  const supportedRegex = /(youtube\.com|youtu\.be|facebook\.com|fb\.watch|instagram\.com)/i;

  if (!supportedRegex.test(trimmedUrl)) {
    return res.status(400).json({
      success: false,
      error: 'Only public YouTube, Facebook, or Instagram links are supported.'
    });
  }

  let platform = 'Social Media';
  if (/youtube\.com|youtu\.be/i.test(trimmedUrl)) platform = 'YouTube';
  else if (/facebook\.com|fb\.watch/i.test(trimmedUrl)) platform = 'Facebook';
  else if (/instagram\.com/i.test(trimmedUrl)) platform = 'Instagram';

  const apiInstances = process.env.COBALT_API_URL
    ? [process.env.COBALT_API_URL]
    : [
        'https://cobalt-api.kwiatekmiki.com',
        'https://api.cobalt.best',
        'https://cobalt.canine.tools'
      ];

  const payload = {
    url: trimmedUrl,
    videoQuality: String(quality),
    audioFormat: 'mp3',
    downloadMode: audioOnly ? 'audio' : 'auto',
    filenameStyle: 'pretty'
  };

  let lastError = 'All extraction servers are busy right now.';

  for (const instance of apiInstances) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const response = await fetch(`${instance}/`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'VIDEO_DOWNLOADER-By-Muhammad-Uzair/2.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok || data.status === 'error') {
        lastError = data?.error?.code || 'Could not fetch media for this link.';
        continue;
      }

      if (data.status === 'tunnel' || data.status === 'redirect') {
        return res.status(200).json({
          success: true,
          type: 'single',
          platform,
          quality: audioOnly ? 'MP3 Audio' : `${quality}p`,
          downloadUrl: data.url,
          filename: data.filename || `VIDEO_DOWNLOADER_${platform.toLowerCase()}.${audioOnly ? 'mp3' : 'mp4'}`
        });
      }

      if (data.status === 'picker' && Array.isArray(data.picker)) {
        return res.status(200).json({
          success: true,
          type: 'picker',
          platform,
          quality: audioOnly ? 'MP3 Audio' : `${quality}p`,
          items: data.picker.map((item, idx) => ({
            url: item.url,
            thumb: item.thumb || null,
            type: item.type || 'media',
            label: `Item #${idx + 1}`
          }))
        });
      }
    } catch (err) {
      lastError = err.name === 'AbortError' ? 'Request timed out.' : err.message;
    }
  }

  return res.status(502).json({
    success: false,
    error: `Unable to fetch video (${lastError}). Make sure the post/video is public and try again.`
  });
}
