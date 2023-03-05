// Copyright 2022 The MediaPipe Authors.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//      http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js";
// const { HandLandmarker } = vision;
import vision from "https://cdn.skypack.dev/@mediapipe/tasks-vision@latest";
const { HandLandmarker, FilesetResolver } = vision;

let audioContext;
let oscillator;
let gain;

const minFreq = 100;
const maxFreq = 1000;
const interpolationTime = 0.15; // seconds

const demosSection = document.getElementById("demos");

let handLandmarker = undefined;
let runningMode = "IMAGE";
let enableWebcamButton;
let enableAudioButton;
let webcamRunning = false;
let audioRunning = false;
let audioInit = false;
const videoHeight = "360px";
const videoWidth = "480px";

// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
async function runDemo() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-assets/hand_landmarker.task`
    },
    runningMode: runningMode,
    numHands: 1
  });
  demosSection.classList.remove("invisible");
}
runDemo();

/********************************************************************
// Demo 2: Continuously grab image from webcam stream and detect it.
********************************************************************/

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");

// Check if webcam access is supported.
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);

  enableAudioButton = document.getElementById("audioButton");
  enableAudioButton.addEventListener("click", enableAudio);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
function enableCam(event) {
  if (!handLandmarker) {
    console.log("Wait! objectDetector not loaded yet.");
    return;
  }

  if (webcamRunning === true) {
    webcamRunning = false;
    enableWebcamButton.innerText = "ENABLE PREDICTIONS";
  } else {
    console.log("webcam was off");
    webcamRunning = true;
    enableWebcamButton.innerText = "DISABLE PREDICITONS";
  }

  // getUsermedia parameters.
  const constraints = {
    video: true
  };

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
}

function enableAudio(event) {
  if (audioInit === true) {
    if (audioRunning === true) {
      gain.gain.value = 0.0;
      audioRunning = false;
      enableAudioButton.innerText = "UNMUTE";
    } else {
      gain.gain.value = 1.0;
      audioRunning = true;
      enableAudioButton.innerText = "MUTE";
    }
  }
  if (audioInit == false) {
    let WAContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new WAContext();
    oscillator = audioContext.createOscillator();
    gain = audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.frequency.value = 440;
    gain.gain.value = 0.0;
    oscillator.start(0);
    audioInit = true;
    enableAudioButton.innerText = "UNMUTE";
  }  
}

async function predictWebcam() {
  canvasElement.style.height = videoHeight;
  video.style.height = videoHeight;
  canvasElement.style.width = videoWidth;
  video.style.width = videoWidth;
  // Now let's start detecting the stream.
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await handLandmarker.setOptions({ runningMode: runningMode });
  }
  let nowInMs = Date.now();
  const results = handLandmarker.detectForVideo(video, nowInMs);

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  if (results.landmarks) {
    if (audioRunning === true) {
      if(results.landmarks.length === 1){
        let coordinates = results.landmarks[0][9];
        gain.gain.linearRampToValueAtTime(coordinates.y, audioContext.currentTime + interpolationTime);
        oscillator.frequency.linearRampToValueAtTime(((1.0 - coordinates.x) * (maxFreq - minFreq)) + minFreq, audioContext.currentTime + interpolationTime);
      }
      if(results.landmarks.length === 2){
        let c1 = results.landmarks[0][9];
        let c2 = results.landmarks[1][9];
      }
    }
    for (const landmarks of results.landmarks) {
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 5
      });
      drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });
    }
  }
  canvasCtx.restore();

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}
