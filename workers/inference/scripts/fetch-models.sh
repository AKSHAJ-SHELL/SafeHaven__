#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR_WORKER="$(cd "$(dirname "$0")/.." && pwd)"
MODELS_DIR="$ROOT_DIR_WORKER/models"
mkdir -p "$MODELS_DIR"

YOLO_URL_PRIMARY="https://huggingface.co/SpotLab/YOLOv8Detection/resolve/3005c6751fb19cdeb6b10c066185908faf66a097/yolov8n.onnx"
YOLO_URL_FALLBACK1="https://raw.githubusercontent.com/ultralytics/assets/main/onnx/yolov8n.onnx"
YOLO_URL_FALLBACK2="https://github.com/ultralytics/ultralytics/releases/download/v8.0.0/yolov8n.onnx"
MNV2_URL_PRIMARY="https://huggingface.co/webml/models-moved/resolve/main/mobilenetv2-12.onnx"
echo "[fetch-models] Target directory: $MODELS_DIR"

download_valid() {
  local url="$1"; local out="$2"; local min_size="$3"
  rm -f "$out.tmp"
  echo "[fetch-models] Downloading: $url"
  curl -L --fail --silent --show-error "$url" -o "$out.tmp" || { echo "[fetch-models] Failed: $url"; return 1; }
  local size
  size=$(wc -c < "$out.tmp" | tr -d ' ')
  echo "[fetch-models] Downloaded size: $size bytes"
  if [[ "$size" -lt "$min_size" ]]; then
    rm -f "$out.tmp"
    echo "[fetch-models] File too small (<$min_size), rejecting"
    return 1
  fi
  mv "$out.tmp" "$out"
  echo "[fetch-models] Saved to: $out"
  return 0
}

if [[ ! -f "$MODELS_DIR/yolov8n.onnx" ]]; then
  download_valid "$YOLO_URL_PRIMARY" "$MODELS_DIR/yolov8n.onnx" 3000000 || \
  download_valid "$YOLO_URL_FALLBACK1" "$MODELS_DIR/yolov8n.onnx" 3000000 || \
  download_valid "$YOLO_URL_FALLBACK2" "$MODELS_DIR/yolov8n.onnx" 3000000 || { echo "[fetch-models] Failed to fetch YOLOv8n ONNX"; exit 1; }
fi

if [[ ! -f "$MODELS_DIR/mobilenetv2.onnx" ]]; then
  download_valid "$MNV2_URL_PRIMARY" "$MODELS_DIR/mobilenetv2.onnx" 3000000 || { echo "[fetch-models] Failed to fetch MobileNetV2 ONNX"; exit 1; }
fi

if [[ ! -f "$MODELS_DIR/labels.txt" ]]; then
  cat > "$MODELS_DIR/labels.txt" <<'EOF'
person
bicycle
car
motorcycle
airplane
bus
train
truck
boat
traffic light
fire hydrant
stop sign
parking meter
bench
bird
cat
dog
horse
sheep
cow
elephant
bear
zebra
giraffe
backpack
umbrella
handbag
tie
suitcase
frisbee
skis
snowboard
sports ball
kite
baseball bat
baseball glove
skateboard
surfboard
tennis racket
bottle
wine glass
cup
fork
knife
spoon
bowl
banana
apple
sandwich
orange
broccoli
carrot
hot dog
pizza
donut
cake
chair
couch
potted plant
bed
dining table
toilet
tv
laptop
mouse
remote
keyboard
cell phone
microwave
oven
toaster
sink
refrigerator
book
clock
vase
scissors
teddy bear
hair drier
toothbrush
EOF
fi

echo "[fetch-models] Final contents:"
ls -lh "$MODELS_DIR" || true
echo "[fetch-models] Done"
