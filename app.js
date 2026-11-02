document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const selectBtn = document.getElementById('selectBtn');
  const queueSection = document.getElementById('queueSection');
  const fileList = document.getElementById('fileList');

  const MAX_SIZE = 1024 * 1024 * 1024; // 1 ГБ
  const CHUNK_SIZE = 8 * 1024 * 1024;  // 8 МБ чанк

  selectBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      if (file.size > MAX_SIZE) {
        alert(`Файл "${file.name}" превышает лимит в 1 ГБ.`);
        return;
      }
      uploadFileInChunks(file);
    });
    fileInput.value = '';
  });

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async function uploadFileInChunks(file) {
    queueSection.classList.remove('hidden');
    const fileId = 'file-' + Math.random().toString(36).substring(2, 9);

    const itemEl = document.createElement('div');
    itemEl.className = 'file-item';
    itemEl.innerHTML = `
      <div class="file-info">
        <span class="file-name" title="${file.name}">${file.name}</span>
        <span class="file-size">${formatBytes(file.size)}</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar" id="pb-${fileId}"></div>
      </div>
      <div class="file-status" id="status-${fileId}">
        <span>Подготовка...</span>
        <span id="percent-${fileId}">0%</span>
      </div>
    `;
    fileList.appendChild(itemEl);

    const pb = document.getElementById(`pb-${fileId}`);
    const percentText = document.getElementById(`percent-${fileId}`);
    const statusText = document.getElementById(`status-${fileId}`);

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedBytes = 0;

    try {
      const concurrency = 3;
      let currentChunk = 0;

      async function sendNextBatch() {
        while (currentChunk < totalChunks) {
          const chunkIndex = currentChunk++;
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          const formData = new FormData();
          formData.append('file', chunk);
          formData.append('fileName', file.name);
          formData.append('chunkIndex', chunkIndex);
          formData.append('totalChunks', totalChunks);

          const res = await fetch('/.netlify/functions/upload-chunk', {
            method: 'POST',
            body: formData
          });

          if (!res.ok) throw new Error('Ошибка загрузки чанка');

          uploadedBytes += (end - start);
          const percent = Math.round((uploadedBytes / file.size) * 100);
          pb.style.width = `${percent}%`;
          percentText.textContent = `${percent}%`;
          statusText.firstElementChild.textContent = 'Загрузка...';
        }
      }

      const workers = [];
      for (let i = 0; i < concurrency; i++) {
        workers.push(sendNextBatch());
      }
      await Promise.all(workers);

      pb.style.width = '100%';
      percentText.textContent = '100%';
      statusText.innerHTML = '<span style="color: var(--success-color)">Успешно загружено!</span>';

    } catch (err) {
      statusText.innerHTML = '<span style="color: var(--error-color)">Ошибка сети / Прервано</span>';
    }
  }
});
