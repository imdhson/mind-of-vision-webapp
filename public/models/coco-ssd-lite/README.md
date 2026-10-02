# COCO-SSD Lite model directory

This directory contains the official TensorFlow.js COCO-SSD Lite (`ssdlite_mobilenet_v2`) model, deployed together with the app.
The app loads `models/coco-ssd-lite/model.json` first and falls back to the official Google Cloud Storage copy if it is unavailable.
Run `npm run models:download` to re-download these files (`-- --all` also fetches the larger MobileNet V2 model, which is git-ignored).

Model attribution: TensorFlow.js Models / COCO-SSD, Apache License 2.0.
