let landmarks = [];
const strokes = [];

let video;
let hands;
let isProcessing = false;

const MAX_STROKES = 5000;

const MODES = {
  DRAW: "draw",
  ERASE: "erase",
};

const GESTURES = {
  DRAW: "draw",
  ERASE: "erase",
  CLEAR: "clear",
  PAUSE: "pause",
  POINT: "point",
  OPEN_PALM: "open_palm",
  NONE: "none",
};

const gestureLabels = {
  [GESTURES.DRAW]: "DRAW",
  [GESTURES.ERASE]: "ERASE",
  [GESTURES.CLEAR]: "CLEAR",
  [GESTURES.PAUSE]: "PAUSED",
  [GESTURES.POINT]: "POINT MODE",
  [GESTURES.NONE]: "NONE",
};

let currentGesture = GESTURES.NONE;

function setup() {
  createCanvas(windowWidth, windowHeight);

  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  hands.onResults((results) => {
    landmarks = results.multiHandLandmarks || [];
  });
}

const isPinch = (hand) => {
  const thumb = hand[4];
  const index = hand[8];
  const d = dist(thumb.x, thumb.y, index.x, index.y);
  return d < 0.03 && hand[12].y > hand[11].y;
};

const isEraseGesture = (hand) => {
  const d = dist(hand[8].x, hand[8].y, hand[12].x, hand[12].y);
  return (
    hand[8].y < hand[6].y &&
    hand[12].y < hand[10].y &&
    hand[16].y > hand[14].y &&
    hand[20].y > hand[18].y
  );
};

const isOpenPalm = (hand) => {
  return (
    hand[8].y < hand[6].y &&
    hand[12].y < hand[10].y &&
    hand[16].y < hand[14].y &&
    hand[20].y < hand[18].y &&
    hand[4].x > hand[3].x
  );
};

const isFist = (hand) => {
  return (
    hand[8].y > hand[6].y &&
    hand[12].y > hand[10].y &&
    hand[16].y > hand[14].y &&
    hand[20].y > hand[18].y &&
    hand[4].x < hand[2].x &&
    !isPinch(hand)
  );
};

const isPointing = (hand) => {
  return (
    hand[8].y < hand[6].y &&
    hand[12].y > hand[10].y &&
    hand[16].y > hand[14].y &&
    hand[20].y > hand[18].y
  );
};

const getGesture = () => {
  if (!landmarks.length) return GESTURES.NONE;

  const hand = landmarks[0];

  if (isFist(hand)) return GESTURES.PAUSE;
  if (isOpenPalm(hand)) return GESTURES.CLEAR;
  if (isPinch(hand)) return GESTURES.DRAW;
  if (isEraseGesture(hand)) return GESTURES.ERASE;
  // if (isPointing(hand)) return GESTURES.POINT;

  return GESTURES.NONE;
};

const updateDrawing = () => {
  landmarks.forEach((hand) => {
    if (!hand[4] || !hand[8]) return;

    const thumb = hand[4];
    const index = hand[8];

    const tx = (1 - thumb.x) * width;
    const ty = thumb.y * height;
    const ix = (1 - index.x) * width;
    const iy = index.y * height;

    const d = dist(tx, ty, ix, iy);
    const threshold = width * 0.03;

    if (d < threshold) {
      strokes.push({ x: tx, y: ty });


      if (strokes.length > MAX_STROKES) {
        strokes.splice(0, strokes.length - MAX_STROKES);
      }
    }
  });
};



const removeOverlappingElements = (cx, cy, size) => {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const p = strokes[i];
    if (dist(cx, cy, p.x, p.y) < size / 2) {
      strokes.splice(i, 1);
    }
  }
};

const erase = () => {
  landmarks.forEach((hand) => {
    if (!hand[8] || !hand[12]) return;

    const ix = (1 - hand[8].x) * width;
    const iy = hand[8].y * height;
    const mx = (1 - hand[12].x) * width;
    const my = hand[12].y * height;

    const size = dist(ix, iy, mx, my)
    const cx = (ix + mx) / 2;
    const cy = (iy + my) / 2;

    fill(255);
    noStroke();
    circle(cx, cy, size);
    removeOverlappingElements(cx, cy, size);
  });
};

const drawStrokes = () => {
  strokeWeight(10);
  stroke(0, 0, 255);

  for (let i = 0; i < strokes.length; i++) {
    point(strokes[i].x, strokes[i].y);
  }
};

const processVideo = () => {
  image(video, 0, 0, width, height);

  if (video.elt.readyState >= 2 && !isProcessing) {
    isProcessing = true;
    hands.send({ image: video.elt }).finally(() => {
      isProcessing = false;
    });
  }
};


const update = () => {
  currentGesture = getGesture();

  switch (currentGesture) {
    case GESTURES.DRAW:
      updateDrawing();
      break;

    case GESTURES.ERASE:
      erase();
      break;

    case GESTURES.CLEAR:
      strokes.length = 0;
      break;

    case GESTURES.PAUSE:
      break;

    case GESTURES.POINT:
      updateDrawing();
      break;
  }
};

const drawModeUI = () => {
  push();
  resetMatrix();

  fill(0);
  noStroke();
  textSize(18);
  textAlign(RIGHT, TOP);

  text(`Gesture: ${gestureLabels[currentGesture]}`, width - 20, 20);
  pop();
};

function draw() {
  push();
  translate(width, 0);
  scale(-1, 1);
  processVideo()
  pop();

  update()
  drawStrokes();
  drawModeUI();
}