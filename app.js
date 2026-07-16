const video = document.getElementById("video");
const preview = document.querySelector(".preview");
const emptyState = document.getElementById("emptyState");
const fileInput = document.getElementById("fileInput");
const playButton = document.getElementById("playButton");
const playSeek = document.getElementById("playSeek");
const segmentDrag = document.getElementById("segmentDrag");
const segmentStartSeek = document.getElementById("segmentStartSeek");
const segmentEndSeek = document.getElementById("segmentEndSeek");
const playLabel = document.getElementById("playLabel");
const startLabel = document.getElementById("startLabel");
const currentTime = document.getElementById("currentTime");
const durationTime = document.getElementById("durationTime");
const gifDuration = document.getElementById("gifDuration");
const gifWidth = document.getElementById("gifWidth");
const gifFps = document.getElementById("gifFps");
const makeButton = document.getElementById("makeButton");
const progress = document.getElementById("progress");
const statusText = document.getElementById("status");
const result = document.getElementById("result");
const resultImage = document.getElementById("resultImage");
const resultMeta = document.getElementById("resultMeta");
const downloadLink = document.getElementById("downloadLink");

let sourceUrl = "";
let resultUrl = "";
let isSeekingFromSlider = false;
let segmentDragState = null;

function secondsLabel(value) {
  return `${Number(value || 0).toFixed(1)} (초)`;
}

function fileSizeLabel(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function setStatus(message) {
  statusText.textContent = message;
}

function videoDuration() {
  return Number.isFinite(video.duration) ? video.duration : 0;
}

function gifDurationValue() {
  return Number(gifDuration.value) || 0;
}

function segmentStartValue() {
  return Number(segmentStartSeek.value) || 0;
}

function segmentEndValue() {
  return Number(segmentEndSeek.value) || 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeSegmentRange(changedHandle) {
  const total = videoDuration();
  if (!total) {
    return;
  }

  const minDuration = Math.min(0.1, total);
  let start = Math.max(0, Math.min(segmentStartValue(), total - minDuration));
  let end = Math.max(minDuration, Math.min(segmentEndValue(), total));

  if (end - start < minDuration) {
    if (changedHandle === "end") {
      start = Math.max(0, end - minDuration);
    } else {
      end = Math.min(total, start + minDuration);
      if (end - start < minDuration) {
        start = Math.max(0, end - minDuration);
      }
    }
  }

  segmentStartSeek.value = start;
  segmentEndSeek.value = end;
}

function timeFromPointer(clientX) {
  const total = videoDuration();
  if (!total) {
    return 0;
  }

  const rect = segmentDrag.parentElement.getBoundingClientRect();
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  return ratio * total;
}

function moveSegmentTo(start) {
  const total = videoDuration();
  const duration = segmentEndValue() - segmentStartValue();
  if (!total || duration <= 0) {
    return;
  }

  const nextStart = clamp(start, 0, Math.max(0, total - duration));
  segmentStartSeek.value = nextStart;
  segmentEndSeek.value = nextStart + duration;
  updateTimeLabels();
}

function updateSeekFill() {
  const total = videoDuration();
  const start = segmentStartValue();
  const end = segmentEndValue();

  if (!total) {
    playSeek.style.removeProperty("--play-progress");
    document.documentElement.style.removeProperty("--segment-start");
    document.documentElement.style.removeProperty("--segment-end");
    return;
  }

  playSeek.style.setProperty("--play-progress", `${Math.max(0, Math.min(100, (video.currentTime || 0) / total * 100))}%`);
  document.documentElement.style.setProperty("--segment-start", `${Math.max(0, Math.min(100, start / total * 100))}%`);
  document.documentElement.style.setProperty("--segment-end", `${Math.max(0, Math.min(100, end / total * 100))}%`);
}

function updatePlayButton() {
  playButton.textContent = video.paused ? "▶" : "❚❚";
  playButton.setAttribute("aria-label", video.paused ? "재생" : "일시정지");
  playButton.classList.toggle("is-playing", !video.paused);
}

function updateTimeLabels() {
  const duration = videoDuration();
  const current = video.currentTime || 0;
  const start = segmentStartValue();
  const end = Math.min(duration, segmentEndValue());
  const segmentDuration = Math.max(0, end - start);
  playLabel.textContent = secondsLabel(current);
  currentTime.textContent = secondsLabel(current);
  durationTime.textContent = secondsLabel(duration);
  startLabel.textContent = `${secondsLabel(start)} ~ ${secondsLabel(end)} / ${secondsLabel(segmentDuration)}`;
  updateSeekFill();
}

function waitForEvent(target, eventName) {
  return new Promise((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("영상을 읽는 중 문제가 발생했습니다."));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener("error", onError);
    };
    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

async function seekVideo(time) {
  const target = Math.max(0, Math.min(time, video.duration || 0));
  if (Math.abs(video.currentTime - target) < 0.04) {
    return;
  }
  const pending = waitForEvent(video, "seeked");
  video.currentTime = target;
  await pending;
}

function prepareCanvas(width) {
  const sourceWidth = video.videoWidth || 640;
  const sourceHeight = video.videoHeight || 360;
  const height = Math.max(1, Math.round(width * sourceHeight / sourceWidth));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    return;
  }

  if (sourceUrl) {
    URL.revokeObjectURL(sourceUrl);
  }

  sourceUrl = URL.createObjectURL(file);
  playSeek.value = 0;
  segmentStartSeek.value = 0;
  segmentEndSeek.value = gifDurationValue();
  video.currentTime = 0;
  updateTimeLabels();
  video.src = sourceUrl;
  video.load();
  emptyState.hidden = true;
  playButton.disabled = false;
  makeButton.disabled = false;
  playSeek.disabled = false;
  segmentStartSeek.disabled = false;
  segmentEndSeek.disabled = false;
  result.hidden = true;
  resultMeta.textContent = "";
  downloadLink.classList.add("disabled");
  downloadLink.setAttribute("aria-disabled", "true");
  downloadLink.removeAttribute("href");
  setStatus("영상을 불러오는 중입니다...");
});

video.addEventListener("loadedmetadata", () => {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  playSeek.max = Math.max(0, duration);
  segmentStartSeek.max = Math.max(0, duration);
  segmentEndSeek.max = Math.max(0, duration);
  playSeek.value = 0;
  segmentStartSeek.value = 0;
  segmentEndSeek.value = Math.min(duration, gifDurationValue());
  video.currentTime = 0;
  updatePlayButton();
  updateTimeLabels();
  setStatus("GIF 구간의 시작점과 끝점을 자유롭게 조절할 수 있습니다. 노란 구간이 GIF로 만들어질 부분입니다.");
});

video.addEventListener("timeupdate", () => {
  if (!isSeekingFromSlider) {
    playSeek.value = video.currentTime || 0;
  }
  updateTimeLabels();
});

video.addEventListener("ended", () => {
  updatePlayButton();
});

video.addEventListener("play", updatePlayButton);
video.addEventListener("pause", updatePlayButton);

async function playVideo() {
  if (video.src && video.paused) {
    await video.play();
  }
  updatePlayButton();
}

function pauseVideo() {
  if (video.src && !video.paused) {
    video.pause();
  }
  updatePlayButton();
}

async function togglePlayback(event) {
  if (event) {
    event.stopPropagation();
  }

  if (video.paused) {
    await playVideo();
  } else {
    pauseVideo();
  }
}

playButton.addEventListener("click", togglePlayback);

async function toggleFromPreview(event) {
  if (!video.src || event.target.closest("button")) {
    return;
  }

  event.preventDefault();
  await togglePlayback(event);
}

preview.addEventListener("pointerup", toggleFromPreview);

playSeek.addEventListener("input", () => {
  isSeekingFromSlider = true;
  updateTimeLabels();
});

playSeek.addEventListener("change", async () => {
  try {
    await seekVideo(Number(playSeek.value));
  } finally {
    isSeekingFromSlider = false;
    updateTimeLabels();
  }
});

segmentStartSeek.addEventListener("input", () => {
  normalizeSegmentRange("start");
  updateTimeLabels();
});

segmentStartSeek.addEventListener("change", async () => {
  normalizeSegmentRange("start");
  await seekVideo(segmentStartValue());
  playSeek.value = video.currentTime || 0;
  updateTimeLabels();
});

segmentEndSeek.addEventListener("input", () => {
  normalizeSegmentRange("end");
  updateTimeLabels();
});

segmentEndSeek.addEventListener("change", async () => {
  normalizeSegmentRange("end");
  await seekVideo(segmentEndValue());
  playSeek.value = video.currentTime || 0;
  updateTimeLabels();
});

segmentDrag.addEventListener("pointerdown", event => {
  if (!video.src || !videoDuration()) {
    return;
  }

  event.preventDefault();
  const pointerTime = timeFromPointer(event.clientX);
  segmentDragState = {
    pointerId: event.pointerId,
    offset: pointerTime - segmentStartValue()
  };
  segmentDrag.classList.add("is-dragging");
  segmentDrag.setPointerCapture(event.pointerId);
});

segmentDrag.addEventListener("pointermove", event => {
  if (!segmentDragState || segmentDragState.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  moveSegmentTo(timeFromPointer(event.clientX) - segmentDragState.offset);
});

async function finishSegmentDrag(event) {
  if (!segmentDragState || segmentDragState.pointerId !== event.pointerId) {
    return;
  }

  segmentDragState = null;
  segmentDrag.classList.remove("is-dragging");
  segmentDrag.releasePointerCapture(event.pointerId);
  await seekVideo(segmentStartValue());
  playSeek.value = video.currentTime || 0;
  updateTimeLabels();
}

segmentDrag.addEventListener("pointerup", finishSegmentDrag);
segmentDrag.addEventListener("pointercancel", finishSegmentDrag);

gifDuration.addEventListener("change", () => {
  const duration = videoDuration();
  const preset = gifDurationValue();
  let start = segmentStartValue();
  let end = start + preset;

  if (duration && end > duration) {
    end = duration;
    start = Math.max(0, end - preset);
  }

  segmentStartSeek.value = start;
  segmentEndSeek.value = end;
  updateTimeLabels();
});

makeButton.addEventListener("click", async () => {
  if (!video.src || !Number.isFinite(video.duration)) {
    setStatus("먼저 영상 파일을 선택해 주세요.");
    return;
  }

  const start = segmentStartValue();
  const end = segmentEndValue();
  const duration = end - start;
  if (duration < 0.1) {
    setStatus("GIF 구간의 끝점은 시작점보다 뒤에 있어야 합니다.");
    return;
  }

  makeButton.disabled = true;
  playButton.disabled = true;
  progress.hidden = false;
  progress.value = 0;
  result.hidden = true;
  resultMeta.textContent = "";
  video.pause();
  updatePlayButton();

  try {
    const width = Number(gifWidth.value);
    const fps = Number(gifFps.value);
    const frameCount = Math.max(1, Math.round(duration * fps));
    const canvas = prepareCanvas(width);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: canvas.width,
      height: canvas.height,
      workerScript: "vendor/gif.worker.js"
    });

    setStatus("GIF에 넣을 프레임을 준비하는 중입니다...");

    for (let i = 0; i < frameCount; i += 1) {
      const time = Math.min(start + i / fps, Math.max(0, video.duration - 0.05));
      await seekVideo(time);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      gif.addFrame(context, { copy: true, delay: 1000 / fps });
      progress.value = Math.round((i + 1) / frameCount * 70);
    }

    setStatus("GIF 파일을 만드는 중입니다...");

    gif.on("progress", value => {
      progress.value = 70 + Math.round(value * 30);
    });

    gif.on("finished", blob => {
      if (resultUrl) {
        URL.revokeObjectURL(resultUrl);
      }
      resultUrl = URL.createObjectURL(blob);
      resultImage.src = resultUrl;
      resultMeta.textContent = `최종 용량: ${fileSizeLabel(blob.size)}`;
      downloadLink.href = resultUrl;
      downloadLink.download = `gif-${duration}sec-${width}px.gif`;
      downloadLink.classList.remove("disabled");
      downloadLink.setAttribute("aria-disabled", "false");
      result.hidden = false;
      progress.value = 100;
      progress.hidden = true;
      makeButton.disabled = false;
      playButton.disabled = false;
      setStatus(`완료되었습니다. 최종 용량은 ${fileSizeLabel(blob.size)}입니다.`);
      result.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    gif.render();
  } catch (error) {
    progress.hidden = true;
    makeButton.disabled = false;
    playButton.disabled = false;
    setStatus(error.message || "GIF를 만들 수 없습니다.");
  }
});


