const uploadSection = document.getElementById('drop-zone');
const imageUpload = document.getElementById('image-upload');
const imagePreview = document.getElementById('image-preview');
const uploadLabelContent = document.querySelector('.upload-label p');
const uploadIcon = document.querySelector('.upload-label .icon');

const promptInput = document.getElementById('prompt-input');
const analyzeBtn = document.getElementById('analyze-btn');
const btnText = document.querySelector('.btn-text');
const loader = document.querySelector('.loader');

const statusMessage = document.getElementById('status-message');
const resultOutput = document.getElementById('result-output');

let currentImageBase64 = null;

// Handle Drag & Drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  uploadSection.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
  uploadSection.addEventListener(eventName, () => uploadSection.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
  uploadSection.addEventListener(eventName, () => uploadSection.classList.remove('dragover'), false);
});

uploadSection.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
});

imageUpload.addEventListener('change', function() {
  handleFiles(this.files);
});

promptInput.addEventListener('input', checkValidation);

function handleFiles(files) {
  if (files.length === 0) return;
  const file = files[0];
  
  if (!file.type.startsWith('image/')) {
    showStatus('Please upload an image file.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    currentImageBase64 = e.target.result.split(',')[1]; // Get Base64 part only
    imagePreview.src = e.target.result;
    imagePreview.style.display = 'block';
    uploadLabelContent.style.display = 'none';
    uploadIcon.style.display = 'none';
    checkValidation();
  };
  reader.readAsDataURL(file);
}

function checkValidation() {
  if (currentImageBase64 && promptInput.value.trim() !== '') {
    analyzeBtn.disabled = false;
  } else {
    analyzeBtn.disabled = true;
  }
}

function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.style.color = type === 'error' ? 'var(--error)' : (type === 'success' ? 'var(--success)' : 'var(--accent-primary)');
}

// Custom simple markdown parser for bold/italics/lists
function parseMarkdown(text) {
  let html = text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\* (.*$)/gim, '<li>$1</li>');
  
  // Wrap li's in ul
  html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
  // cleanup contiguous uls if needed, but for simplicity we let browser handle it.
  
  return html.replace(/\n$/gim, '<br />');
}

// The core analyze function with exponential backoff for rate limits
async function analyzeImage(retries = 3, delay = 2000) {
  const prompt = promptInput.value.trim();

  try {
    const response = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: currentImageBase64,
        prompt: prompt
      })
    });

    const data = await response.json();

    // Check for rate limit specifically (429)
    if (response.status === 429 && retries > 0) {
      showStatus(`Rate limit hit. Retrying in ${delay/1000}s... (${retries} retries left)`, 'error');
      await new Promise(r => setTimeout(r, delay));
      return analyzeImage(retries - 1, delay * 2);
    }

    if (!response.ok) {
      throw new Error(data.error?.message || data.error || `HTTP error ${response.status}`);
    }

    // Parse the Gemini Response structure
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) {
       throw new Error('Unexpected API response format');
    }

    resultOutput.classList.remove('placeholder');
    resultOutput.innerHTML = parseMarkdown(textResult);
    showStatus('Analysis complete ✨', 'success');

  } catch (error) {
    if (error.message.includes('AI binding')) {
       resultOutput.innerHTML = `<strong>Setup Required:</strong><br><br>The Cloudflare backend is missing the AI binding.<br>Make sure the <code>[ai]</code> configuration is correctly set in your wrangler.toml or Cloudflare Dashboard.`;
    } else {
       resultOutput.textContent = error.message;
    }
    resultOutput.classList.remove('placeholder');
    showStatus('An error occurred.', 'error');
  } finally {
    setLoadingState(false);
  }
}

function setLoadingState(isLoading) {
  if (isLoading) {
    btnText.style.display = 'none';
    loader.style.display = 'block';
    analyzeBtn.disabled = true;
    promptInput.disabled = true;
    imageUpload.disabled = true;
    uploadSection.style.opacity = '0.5';
    uploadSection.style.pointerEvents = 'none';
  } else {
    btnText.style.display = 'block';
    loader.style.display = 'none';
    analyzeBtn.disabled = false;
    promptInput.disabled = false;
    imageUpload.disabled = false;
    uploadSection.style.opacity = '1';
    uploadSection.style.pointerEvents = 'auto';
  }
}

analyzeBtn.addEventListener('click', () => {
  setLoadingState(true);
  showStatus('Analyzing image...', 'info');
  resultOutput.innerHTML = '';
  resultOutput.classList.remove('placeholder');
  analyzeImage();
});
