const video = document.getElementById("video");
const emptyState = document.getElementById("emptyState");
const fileInput = document.getElementById("fileInput");
const playButton = document.getElementById("playButton");
const seek = document.getElementById("seek");
const startLabel = document.getElementById("startLabel");
const currentTime = document.getElementById("currentTime");
const durationTime = document.getElementById("durationTime");
const gifDuration = document.getElementById("gifDuration");
const gifWidth = document.getElementById("gifWidth");
const gifFps = document.getElementById("gifFps");
const faceMosaic = document.getElementById("faceMosaic");
const makeButton = document.getElementById("makeButton");
const progress = document.getElementById("progress");
const statusText = document.getElementById("status");
const result = document.getElementById("result");
const resultImage = document.getElementById("resultImage");
const downloadLink = document.getElementById("downloadLink");

let sourceUrl = "";
let resultUrl = "";
let isSeekingFromSlider = false;
let faceDetector = null;

function secondsLabel(value) {
  return `${Number(value || 0).toFixed(1)} (초)`;
}

function setStatus(message) {
  statusText.textContent = message;
}

function updateTimeLabels() {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const current = video.currentTime || 0;
  currentTime.textContent = secondsLabel(current);
  durationTime.textContent = secondsLabel(duration);
  startLabel.textContent = secondsLabel(seek.value);
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

function getFaceDetector() {
  if (!("FaceDetector" in window)) {
    throw new Error("이 브라우저에서는 얼굴 감지가 지원되지 않습니다. Chrome 최신 버전에서 다시 시도해 주세요.");
  }

  if (!faceDetector) {
    faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 20 });
  }

  return faceDetector;
}

async function applyFaceMosaic(canvas, context) {
  const detector = getFaceDetector();
  const faces = await detector.detect(canvas);

  if (!faces.length) {
    return 0;
  }

  for (const face of faces) {
    const box = face.boundingBox;
    const padding = Math.max(box.width, box.height) * 0.18;
    const x = Math.max(0, Math.floor(box.x - padding));
    const y = Math.max(0, Math.floor(box.y - padding));
    const width = Math.min(canvas.width - x, Math.ceil(box.width + padding * 2));
    const height = Math.min(canvas.height - y, Math.ceil(box.height + padding * 2));

    if (width < 8 || height < 8) {
      continue;
    }

    const blockSize = Math.max(6, Math.round(Math.min(width, height) / 8));
    const tinyWidth = Math.max(1, Math.ceil(width / blockSize));
    const tinyHeight = Math.max(1, Math.ceil(height / blockSize));
    const tinyCanvas = document.createElement("canvas");
    tinyCanvas.width = tinyWidth;
    tinyCanvas.height = tinyHeight;
    const tinyContext = tinyCanvas.getContext("2d");

    tinyContext.imageSmoothingEnabled = true;
    tinyContext.drawImage(canvas, x, y, width, height, 0, 0, tinyWidth, tinyHeight);
    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(tinyCanvas, 0, 0, tinyWidth, tinyHeight, x, y, width, height);
    context.restore();
  }

  return faces.length;
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
  seek.value = 0;
  video.currentTime = 0;
  updateTimeLabels();
  video.src = sourceUrl;
  video.load();
  emptyState.hidden = true;
  playButton.disabled = false;
  makeButton.disabled = false;
  seek.disabled = false;
  result.hidden = true;
  downloadLink.classList.add("disabled");
  downloadLink.setAttribute("aria-disabled", "true");
  downloadLink.removeAttribute("href");
  setStatus("영상을 불러오는 중입니다...");
});

video.addEventListener("loadedmetadata", () => {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  seek.max = Math.max(0, duration);
  seek.value = 0;
  video.currentTime = 0;
  updateTimeLabels();
  setStatus("미리보기를 보면서 게이지로 시작 지점을 고르세요.");
});

video.addEventListener("timeupdate", () => {
  if (!isSeekingFromSlider) {
    seek.value = video.currentTime || 0;
  }
  updateTimeLabels();
});

video.addEventListener("ended", () => {
  playButton.textContent = "재생";
});

playButton.addEventListener("click", async () => {
  if (video.paused) {
    await video.play();
    playButton.textContent = "일시정지";
  } else {
    video.pause();
    playButton.textContent = "재생";
  }
});

seek.addEventListener("input", () => {
  isSeekingFromSlider = true;
  updateTimeLabels();
});

seek.addEventListener("change", async () => {
  try {
    await seekVideo(Number(seek.value));
  } finally {
    isSeekingFromSlider = false;
    updateTimeLabels();
  }
});

makeButton.addEventListener("click", async () => {
  if (!video.src || !Number.isFinite(video.duration)) {
    setStatus("먼저 영상 파일을 선택해 주세요.");
    return;
  }

  makeButton.disabled = true;
  playButton.disabled = true;
  progress.hidden = false;
  progress.value = 0;
  result.hidden = true;
  video.pause();
  playButton.textContent = "재생";

  try {
    const start = Number(seek.value);
    const duration = Number(gifDuration.value);
    const width = Number(gifWidth.value);
    const fps = Number(gifFps.value);
    const shouldMosaicFaces = faceMosaic.checked;
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

    if (shouldMosaicFaces) {
      getFaceDetector();
    }

    setStatus(shouldMosaicFaces ? "얼굴을 감지하며 GIF 프레임을 준비하는 중입니다..." : "GIF에 넣을 프레임을 준비하는 중입니다...");

    for (let i = 0; i < frameCount; i += 1) {
      const time = Math.min(start + i / fps, Math.max(0, video.duration - 0.05));
      await seekVideo(time);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (shouldMosaicFaces) {
        await applyFaceMosaic(canvas, context);
      }
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
      downloadLink.href = resultUrl;
      downloadLink.download = `gif-${duration}sec-${width}px.gif`;
      downloadLink.classList.remove("disabled");
      downloadLink.setAttribute("aria-disabled", "false");
      result.hidden = false;
      progress.value = 100;
      progress.hidden = true;
      makeButton.disabled = false;
      playButton.disabled = false;
      setStatus("완료되었습니다. 아래에서 GIF를 미리보고 저장할 수 있습니다.");
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


