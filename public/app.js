const shortenForm = document.getElementById('shortenForm');
const urlInput = document.getElementById('urlInput');
const submitBtn = document.getElementById('submitBtn');
const resultBox = document.getElementById('resultBox');
const shortUrlText = document.getElementById('shortUrlText');
const copyBtn = document.getElementById('copyBtn');
const errorText = document.getElementById('errorText');

const statsForm = document.getElementById('statsForm');
const statsInput = document.getElementById('statsInput');
const statsResult = document.getElementById('statsResult');

shortenForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  errorText.classList.add('hidden');
  resultBox.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Shortening...';

  try {
    const res = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput.value.trim() })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong');
    }

    shortUrlText.textContent = data.shortUrl;
    resultBox.dataset.url = data.shortUrl;
    resultBox.classList.remove('hidden');
    urlInput.value = '';
  } catch (err) {
    errorText.textContent = err.message;
    errorText.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Shorten';
  }
});

copyBtn.addEventListener('click', async () => {
  const url = resultBox.dataset.url;
  await navigator.clipboard.writeText(url);
  copyBtn.textContent = 'Copied!';
  setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
});

statsForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  statsResult.classList.add('hidden');

  // Allow pasting either a full short URL or just the code
  let input = statsInput.value.trim();
  const shortCode = input.includes('/') ? input.split('/').pop() : input;

  try {
    const res = await fetch(`/api/stats/${shortCode}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong');
    }

    const createdDate = new Date(data.created_at).toLocaleString();

    statsResult.innerHTML = `
      <div><strong>Original URL:</strong> ${data.original_url}</div>
      <div><strong>Short Code:</strong> ${data.short_code}</div>
      <div><strong>Clicks:</strong> ${data.click_count}</div>
      <div><strong>Created:</strong> ${createdDate}</div>
    `;
    statsResult.classList.remove('hidden');
  } catch (err) {
    statsResult.innerHTML = `<span style="color:#fb7185">${err.message}</span>`;
    statsResult.classList.remove('hidden');
  }
});