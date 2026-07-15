const video = document.getElementById("video");
const preview = document.querySelector(".preview");
const emptyState = document.getElementById("emptyState");
const fileInput = document.getElementById("fileInput");
const playButton = document.getElementById("playButton");
const playSeek = document.getElementById("playSeek");
const segmentSeek = document.getElementById("segmentSeek");
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

function hasEnoughGifRange(start, duration) {
  return videoDuration() - start >= duration - 0.05;
}

function updateSeekFill() {
  const total = videoDuration();
  const start = Number(segmentSeek.value) || 0;
  const end = Math.min(total, start + gifDurationValue());

  if (!total) {
    playSeek.style.removeProperty("--play-progress");
    segmentSeek.style.removeProperty("--segment-start");
    segmentSeek.style.removeProperty("--segment-end");
    return;
  }

  playSeek.style.setProperty("--play-progress", `${Math.max(0, Math.min(100, (video.currentTime || 0) / total * 100))}%`);
  segmentSeek.style.setProperty("--segment-start", `${Math.max(0, Math.min(100, start / total * 100))}%`);
  segmentSeek.style.setProperty("--segment-end", `${Math.max(0, Math.min(100, end / total * 100))}%`);
}

function updatePlayButton() {
  playButton.textContent = video.paused ? "▶" : "❚❚";
  playButton.setAttribute("aria-label", video.paused ? "재생" : "일시정지");
  playButton.classList.toggle("is-playing", !video.paused);
}

function updateTimeLabels() {
  const duration = videoDuration();
  const current = video.currentTime || 0;
  const start = Number(segmentSeek.value) || 0;
  const end = Math.min(duration, start + gifDurationValue());
  playLabel.textContent = secondsLabel(current);
  currentTime.textContent = secondsLabel(current);
  durationTime.textContent = secondsLabel(duration);
  startLabel.textContent = `${secondsLabel(start)} ~ ${secondsLabel(end)}`;
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
  segmentSeek.value = 0;
  video.currentTime = 0;
  updateTimeLabels();
  video.src = sourceUrl;
  video.load();
  emptyState.hidden = true;
  playButton.disabled = false;
  makeButton.disabled = false;
  playSeek.disabled = false;
  segmentSeek.disabled = false;
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
  segmentSeek.max = Math.max(0, duration);
  playSeek.value = 0;
  segmentSeek.value = 0;
  video.currentTime = 0;
  updatePlayButton();
  updateTimeLabels();
  setStatus("재생 위치와 GIF 구간을 따로 조절할 수 있습니다. 노란 구간이 GIF로 만들어질 부분입니다.");
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

function pauseFromPreview(event) {
  if (!video.src || video.paused || event.target.closest("button")) {
    return;
  }

  event.preventDefault();
  pauseVideo();
}

preview.addEventListener("click", pauseFromPreview);
preview.addEventListener("pointerup", pauseFromPreview);
preview.addEventListener("touchend", pauseFromPreview, { passive: false });

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

segmentSeek.addEventListener("input", updateTimeLabels);
segmentSeek.addEventListener("change", async () => {
  await seekVideo(Number(segmentSeek.value));
  playSeek.value = video.currentTime || 0;
  updateTimeLabels();
});
gifDuration.addEventListener("change", updateTimeLabels);

makeButton.addEventListener("click", async () => {
  if (!video.src || !Number.isFinite(video.duration)) {
    setStatus("먼저 영상 파일을 선택해 주세요.");
    return;
  }

  const start = Number(segmentSeek.value) || 0;
  const duration = Number(gifDuration.value);
  if (!hasEnoughGifRange(start, duration)) {
    setStatus(`선택한 구간이 ${duration} (초)보다 짧습니다. 시작 시간을 앞쪽으로 옮기거나 GIF 길이를 줄여 주세요.`);
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


