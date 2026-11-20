const form = document.getElementById('dl-form');
const urlInput = document.getElementById('url-input');
const pasteBtn = document.getElementById('paste-btn');
const clearBtn = document.getElementById('clear-btn');
const sampleBtn = document.getElementById('sample-btn');
const qualitySelect = document.getElementById('quality-select');
const formatSelect = document.getElementById('format-select');
const submitBtn = document.getElementById('submit-btn');
const btnLabel = document.getElementById('btn-label');
const btnSpinner = document.getElementById('btn-spinner');
const detectedHint = document.getElementById('detected-hint');
const errorBox = document.getElementById('error-box');
const resultBox = document.getElementById('result-box');
const chips = document.querySelectorAll('.plat-chip');

function updatePlatformUI(rawUrl) {
  const val = (rawUrl || '').trim();
  clearBtn.classList.toggle('hidden', val.length === 0);

  let detected = 'all';
  let labelText = 'Auto-detects YouTube, Facebook & Instagram';

  if (/youtube\.com|youtu\.be/i.test(val)) {
    detected = 'youtube';
    labelText = 'YouTube link detected';
  } else if (/facebook\.com|fb\.watch/i.test(val)) {
    detected = 'facebook';
    labelText = 'Facebook link detected';
  } else if (/instagram\.com/i.test(val)) {
    detected = 'instagram';
    labelText = 'Instagram link detected';
  }

  detectedHint.textContent = `Status: ${labelText}`;

  chips.forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.platform === detected);
  });
}

chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const p = chip.dataset.platform;
    const placeholders = {
      all: 'Paste video, Shorts, or Reel link here...',
      youtube: 'https://www.youtube.com/watch?v=... or https://youtu.be/...',
      facebook: 'https://www.facebook.com/reel/... or https://fb.watch/...',
      instagram: 'https://www.instagram.com/reel/... or /p/...'
    };
    urlInput.placeholder = placeholders[p] || placeholders.all;
    chips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    urlInput.focus();
  });
});

urlInput.addEventListener('input', (e) => updatePlatformUI(e.target.value));

pasteBtn.addEventListener('click', async () => {
  errorBox.classList.add('hidden');
  if (!navigator.clipboard || !navigator.clipboard.readText) {
    urlInput.focus();
    showError('Clipboard access is not supported here. Press Ctrl+V / Cmd+V to paste.');
    return;
  }
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      showError('Your clipboard is empty.');
      return;
    }
    urlInput.value = text.trim();
    updatePlatformUI(urlInput.value);
  } catch {
    urlInput.focus();
    showError('Please allow clipboard permission or paste the link manually (Ctrl+V).');
  }
});

clearBtn.addEventListener('click', () => {
  urlInput.value = '';
  errorBox.classList.add('hidden');
  resultBox.classList.add('hidden');
  updatePlatformUI('');
  urlInput.focus();
});

sampleBtn.addEventListener('click', () => {
  urlInput.value = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  updatePlatformUI(urlInput.value);
  errorBox.classList.add('hidden');
});

formatSelect.addEventListener('change', () => {
  qualitySelect.disabled = formatSelect.value === 'audio';
});

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
  resultBox.classList.add('hidden');
}

function setBusy(busy) {
  submitBtn.disabled = busy;
  btnLabel.textContent = busy ? 'Fetching...' : 'Get Download Link';
  btnSpinner.classList.toggle('hidden', !busy);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.classList.add('hidden');
  resultBox.classList.add('hidden');

  const url = urlInput.value.trim();
  const quality = qualitySelect.value;
  const audioOnly = formatSelect.value === 'audio';

  if (!url) {
    showError('Please paste a YouTube, Facebook, or Instagram video URL first.');
    urlInput.focus();
    return;
  }

  setBusy(true);

  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, quality, audioOnly })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Could not extract download link.');
    }

    renderResult(data, audioOnly);
  } catch (err) {
    showError(err.message);
  } finally {
    setBusy(false);
  }
});

function renderResult(data, audioOnly) {
  resultBox.innerHTML = '';

  const meta = document.createElement('div');
  meta.className = 'result-meta';
  meta.innerHTML = `<span><strong>Ready!</strong> Platform: ${data.platform || 'Media'} • ${data.quality || ''}</span><span>${data.filename || ''}</span>`;
  resultBox.appendChild(meta);

  if (data.type === 'single') {
    const a = document.createElement('a');
    a.href = data.downloadUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = data.filename || '';
    a.className = 'dl-btn';
    a.textContent = audioOnly ? 'Download MP3 File' : 'Download Video File';
    resultBox.appendChild(a);
  } else if (data.type === 'picker' && Array.isArray(data.items)) {
    const grid = document.createElement('div');
    grid.className = 'picker-list';

    data.items.forEach((item) => {
      const box = document.createElement('div');
      box.className = 'picker-item';

      if (item.thumb) {
        const img = document.createElement('img');
        img.src = item.thumb;
        img.alt = item.label;
        box.appendChild(img);
      }

      const btn = document.createElement('a');
      btn.href = item.url;
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';
      btn.className = 'dl-btn';
      btn.textContent = `Save ${item.label}`;
      box.appendChild(btn);

      grid.appendChild(box);
    });

    resultBox.appendChild(grid);
  }

  resultBox.classList.remove('hidden');
}
