#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
MODELS_DIR="$ROOT_DIR/workers/inference/models"
mkdir -p "$MODELS_DIR"

YOLO_URL="https://github.com/ultralytics/ultralytics/releases/download/v8.0.0/yolov8n.onnx"
MNV2_URL="https://github.com/onnx/models/raw/main/vision/classification/mobilenet/model/mobilenetv2-12.onnx"

if [[ ! -f "$MODELS_DIR/yolov8n.onnx" ]]; then
  curl -L "$YOLO_URL" -o "$MODELS_DIR/yolov8n.onnx"
fi

if [[ ! -f "$MODELS_DIR/mobilenetv2.onnx" ]]; then
  curl -L "$MNV2_URL" -o "$MODELS_DIR/mobilenetv2.onnx"
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
