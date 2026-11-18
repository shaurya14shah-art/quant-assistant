#!/bin/bash

# Exit on error
set -e

echo "==================================="
echo " Building QuantAssistant App       "
echo "==================================="

echo "[1/4] Building Frontend..."
cd frontend
npm install --legacy-peer-deps
npm run build
cd ..

echo "[2/4] Activating Backend Environment..."
source backend/venv/bin/activate

echo "[3/4] Installing PyInstaller and Dependencies..."
pip install pyinstaller pywebview

echo "[4/4] Bundling App with PyInstaller..."
rm -rf build/ dist/
pyinstaller --clean --noconfirm QuantAssistant.spec

echo "==================================="
echo " Build Complete!                   "
echo " You can find the app in dist/     "
echo "==================================="
