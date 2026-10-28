const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const input = $('#mediaInput');
const audioInput = $('#audioInput');
const video = $('#previewVideo');
const image = $('#previewImage');
const empty = $('#emptyPreview');
const sample = $('#sampleVisual');
const stage = $('#videoStage');
const play = $('#playBtn');
const toast = $('#toast');
const playhead = $('#playhead');
const textOverlay = $('#textOverlay');
const captionOverlay = $('#captionOverlay');

let selectedClip = $('.clip.selected');
let fakeTime = 0;
let fakeTimer = null;
let zoom = 100;
let captionLines = [];
let activeFilter = 'none';

function notify(message, success = false) {
  toast.textContent = message;
  toast.className = 'toast show' + (success ? ' success' : '');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (toast.className = 'toast'), 2400);
}

function format(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  return `00:${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function ensureVisual() {
  if (empty.style.display !== 'none') setPreview('sample');
}

function setPreview(type, src) {
  empty.style.display = 'none';
  video.style.display = 'none';
  image.style.display = 'none';
  sample.style.display = 'none';
  video.pause();

  if (type.startsWith('video')) {
    video.src = src;
    video.style.display = 'block';
    video.onloadedmetadata = () => ($('#duration').textContent = format(video.duration));
  } else if (type.startsWith('image')) {
    image.src = src;
    image.style.display = 'block';
    $('#duration').textContent = '00:00:05';
  } else {
    sample.style.display = 'block';
    $('#duration').textContent = '00:00:20';
  }
  applyFilter(activeFilter);
}

function addFiles(files) {
  [...files].forEach((file) => {
    if (file.type.startsWith('audio')) {
      addAudioClip(file.name);
      return;
    }

    const url = URL.createObjectURL(file);
    const card = document.createElement('button');
    const isImage = file.type.startsWith('image');
    card.className = 'media-card';
    card.innerHTML = `<span class="thumb" style="background:${isImage ? `center/cover url('${url}')` : 'linear-gradient(145deg,#25223a,#4c2b70,#1a4c46)'}"><i>${isImage ? 'IMG' : 'LOCAL'}</i></span><b>${file.name}</b><small>${(file.size / 1048576).toFixed(1)} MB</small>`;
    card.onclick = () => setPreview(file.type, url);
    card.ondblclick = () => addClip(file.name, isImage ? 'image' : 'video');
    $('#mediaGrid').prepend(card);
    setPreview(file.type, url);
  });
  notify(`${files.length} arquivo${files.length > 1 ? 's' : ''} adicionado${files.length > 1 ? 's' : ''}`, true);
}

function addClip(name, type) {
  const clip = document.createElement('button');
  clip.className = 'clip';
  clip.dataset.title = name;
  clip.style.setProperty('--start', Math.min(72, $$('.video-track .clip:not(.caption-clip)').length * 18));
  clip.style.setProperty('--length', 18);
  clip.innerHTML = `<span style="background:${type === 'image' ? 'linear-gradient(90deg,#492e6b,#a66384)' : 'linear-gradient(90deg,#162f42,#623881,#28594f)'}"></span><b>${name}</b><i>00:05</i>`;
  clip.onclick = () => selectClip(clip);
  $('#videoTrack').append(clip);
  selectClip(clip);
  notify('Clipe adicionado à timeline', true);
}

function addAudioClip(name) {
  const clip = document.createElement('button');
  const count = $$('.audio-track .audio-clip').length;
  clip.className = 'audio-clip';
  clip.style.left = `${Math.min(72, count * 19)}%`;
  clip.style.width = '24%';
  clip.innerHTML = `<b>${name}</b><span class="waveform">▁▃▆▄▂▅▇▃▆▂▅▃▇▆▂▃▅</span>`;
  $('.audio-track').append(clip);
  notify(`${name} adicionado ao projeto`, true);
}

function selectClip(element) {
  $$('.clip').forEach((clip) => clip.classList.remove('selected'));
  element.classList.add('selected');
  selectedClip = element;
}

function bindMediaSamples() {
  $$('.sample').forEach((card) => {
    card.onclick = () => {
      setPreview('sample');
      sample.className = 'sample-visual ' + card.dataset.sample;
      notify(`${card.querySelector('b').textContent} selecionado`);
    };
    card.ondblclick = () => addClip(card.querySelector('b').textContent, 'video');
  });
}

input.onchange = (event) => addFiles(event.target.files);
audioInput.onchange = (event) => [...event.target.files].forEach((file) => addAudioClip(file.name));

const zone = $('.upload-zone');
['dragenter', 'dragover'].forEach((eventName) =>
  zone.addEventListener(eventName, (event) => {
    event.preventDefault();
    zone.classList.add('drag');
  }),
);
['dragleave', 'drop'].forEach((eventName) =>
  zone.addEventListener(eventName, (event) => {
    event.preventDefault();
    zone.classList.remove('drag');
  }),
);
zone.ondrop = (event) => addFiles(event.dataTransfer.files);

bindMediaSamples();
$$('.clip').forEach((clip) => (clip.onclick = () => selectClip(clip)));

play.onclick = () => {
  if (video.style.display === 'block' && video.src) {
    if (video.paused) {
      video.play();
      play.textContent = 'Ⅱ';
    } else {
      video.pause();
      play.textContent = '▶';
    }
    return;
  }

  if (fakeTimer) {
    clearInterval(fakeTimer);
    fakeTimer = null;
    play.textContent = '▶';
    return;
  }

  ensureVisual();
  play.textContent = 'Ⅱ';
  fakeTimer = setInterval(() => {
    fakeTime = (fakeTime + 0.1) % 20;
    updateTime(fakeTime, 20);
  }, 100);
};

function updateTime(current, duration) {
  $('#currentTime').textContent = format(current);
  playhead.style.left = `calc(50px + ${(current / duration) * 70}%)`;
  if (captionLines.length) {
    const index = Math.min(captionLines.length - 1, Math.floor((current / duration) * captionLines.length));
    captionOverlay.textContent = captionLines[index];
  }
}

video.ontimeupdate = () => updateTime(video.currentTime, video.duration || 1);
video.onended = () => (play.textContent = '▶');

$('#muteBtn').onclick = () => {
  video.muted = !video.muted;
  notify(video.muted ? 'Áudio silenciado' : 'Áudio ativado');
};
$('#fullscreenBtn').onclick = () => stage.requestFullscreen?.();
$('#loopBtn').onclick = (event) => {
  video.loop = !video.loop;
  event.currentTarget.style.color = video.loop ? 'var(--green)' : '';
  notify(video.loop ? 'Repetição ativada' : 'Repetição desativada');
};

$('#deleteBtn').onclick = () => {
  if (!selectedClip) return;
  const next = selectedClip.nextElementSibling || selectedClip.previousElementSibling;
  selectedClip.remove();
  selectedClip = next;
  if (next?.classList.contains('clip')) selectClip(next);
  notify('Clipe removido');
};

$('#splitBtn').onclick = () => {
  if (!selectedClip) return;
  const clone = selectedClip.cloneNode(true);
  const length = parseFloat(selectedClip.style.getPropertyValue('--length') || 18);
  const start = parseFloat(selectedClip.style.getPropertyValue('--start') || 0);
  selectedClip.style.setProperty('--length', length / 2);
  clone.style.setProperty('--length', length / 2);
  clone.style.setProperty('--start', start + length / 2 + 0.4);
  clone.classList.remove('selected');
  clone.onclick = () => selectClip(clone);
  selectedClip.after(clone);
  notify('Clipe dividido no marcador', true);
};

function setZoom(value) {
  zoom = Math.max(60, Math.min(160, value));
  $('#zoomRange').value = zoom;
  $('#timelineScroll').style.zoom = zoom / 100;
}

$('#zoomRange').oninput = (event) => setZoom(+event.target.value);
$('#zoomIn').onclick = () => setZoom(zoom + 10);
$('#zoomOut').onclick = () => setZoom(zoom - 10);
$('#fitTimeline').onclick = () => setZoom(100);

const panelNames = {
  media: 'Sua mídia',
  text: 'Texto',
  audio: 'Áudio',
  captions: 'Legendas',
  effects: 'Efeitos',
  transitions: 'Transições',
};

function showPanel(name) {
  $$('.tool').forEach((tool) => tool.classList.toggle('active', tool.dataset.panel === name));
  $$('.panel-view').forEach((view) => view.classList.toggle('active', view.dataset.view === name));
  $('#panelTitle').textContent = panelNames[name];
  $('.asset-panel').style.visibility = 'visible';
}

$$('.tool').forEach((tool) => (tool.onclick = () => showPanel(tool.dataset.panel)));
$('.close-panel').onclick = () => ($('.asset-panel').style.visibility = 'hidden');

function updateTextOverlay() {
  ensureVisual();
  textOverlay.hidden = false;
  textOverlay.textContent = $('#textInput').value || 'Texto';
  textOverlay.style.color = $('#textColor').value;
  textOverlay.style.fontSize = `${$('#textSize').value}px`;
}

$('#textInput').oninput = updateTextOverlay;
$('#textColor').oninput = updateTextOverlay;
$('#textSize').oninput = updateTextOverlay;

$$('.text-preset').forEach((button) => {
  button.onclick = () => {
    $$('.text-preset').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    $('#textSize').value = button.dataset.size;
    textOverlay.style.fontWeight = button.dataset.weight;
    textOverlay.style.webkitTextStroke = button.classList.contains('outline') ? '1px currentColor' : '0';
    updateTextOverlay();
  };
});

$('#addTextBtn').onclick = () => {
  updateTextOverlay();
  const label = $('#textInput').value || 'Texto';
  addClip(label, 'text');
  selectedClip.classList.add('text-timeline-clip');
  notify('Texto adicionado e visível na prévia', true);
};

$$('.sound-card').forEach((button) => (button.onclick = () => addAudioClip(button.dataset.track)));
$('#volumeRange').oninput = (event) => {
  const value = +event.target.value;
  video.volume = value / 100;
  $('#volumeValue').textContent = `${value}%`;
};

$('#generateCaptionsBtn').onclick = () => {
  captionLines = $('#captionInput')
    .value.split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!captionLines.length) {
    notify('Escreva pelo menos uma linha de legenda');
    return;
  }

  ensureVisual();
  captionOverlay.hidden = false;
  captionOverlay.textContent = captionLines[0];

  $$('.caption-clip').forEach((clip) => clip.remove());
  captionLines.forEach((line, index) => {
    const clip = document.createElement('button');
    clip.className = 'clip caption-clip';
    clip.style.setProperty('--start', index * (70 / captionLines.length));
    clip.style.setProperty('--length', 68 / captionLines.length);
    clip.innerHTML = `<b>${line}</b>`;
    clip.onclick = () => selectClip(clip);
    $('#videoTrack').append(clip);
  });
  notify(`${captionLines.length} legendas sincronizadas`, true);
};

function applyFilter(filter) {
  activeFilter = filter;
  [video, image, sample].forEach((element) => (element.style.filter = filter));
}

$$('.effect-card').forEach((button) => {
  button.onclick = () => {
    $$('.effect-card').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    ensureVisual();
    applyFilter(button.dataset.filter);
    $('#effectRange').value = 100;
    $('#effectValue').textContent = '100%';
    notify(`Efeito ${button.querySelector('b').textContent} aplicado`, true);
  };
});

$('#effectRange').oninput = (event) => {
  const value = +event.target.value;
  $('#effectValue').textContent = `${value}%`;
  applyFilter(value < 10 ? 'none' : activeFilter);
};
$('#resetEffect').onclick = () => $('.effect-card[data-filter="none"]').click();

$$('.transition-card').forEach((button) => {
  button.onclick = () => {
    if (!selectedClip) {
      notify('Selecione um clipe na timeline');
      return;
    }
    $$('.transition-card').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    selectedClip.classList.add('has-transition');
    selectedClip.dataset.transition = button.dataset.transition;
    $('#transitionStatus').textContent = `${button.querySelector('b').textContent} aplicada`;
    ensureVisual();
    const animationClass = `transition-${button.dataset.transition}`;
    stage.classList.remove('transition-fade', 'transition-slide', 'transition-zoom', 'transition-wipe', 'transition-flash', 'transition-spin');
    void stage.offsetWidth;
    stage.classList.add(animationClass);
    setTimeout(() => stage.classList.remove(animationClass), 800);
    notify('Transição aplicada ao clipe', true);
  };
});

$('#undoBtn').onclick = () => notify('Histórico no início');
$('#redoBtn').onclick = () => notify('Nada para refazer');
$('#shareBtn').onclick = () => {
  navigator.clipboard?.writeText(location.href);
  notify('Link do projeto copiado', true);
};
$('#exportBtn').onclick = () => ($('#exportModal').hidden = false);
$('#closeModal').onclick = () => ($('#exportModal').hidden = true);
$('#exportModal').onclick = (event) => {
  if (event.target.id === 'exportModal') event.currentTarget.hidden = true;
};
$('#exportConfirm').onclick = (event) => {
  event.currentTarget.disabled = true;
  event.currentTarget.textContent = 'Preparando órbita…';
  setTimeout(() => {
    event.currentTarget.disabled = false;
    event.currentTarget.innerHTML = 'Exportar vídeo <span>↗</span>';
    $('#exportModal').hidden = true;
    notify('Vídeo exportado com sucesso', true);
  }, 1800);
};
$('#magnetBtn').onclick = (event) => {
  event.currentTarget.classList.toggle('active');
  notify(event.currentTarget.classList.contains('active') ? 'Encaixe ativado' : 'Encaixe desativado');
};

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
    event.preventDefault();
    play.click();
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedClip && !['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
    $('#deleteBtn').click();
  }
});

