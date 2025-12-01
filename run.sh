#!/bin/bash

# Kill any existing processes on port 5000
echo "Cleaning up previous instances..."
fuser -k 5000/tcp 2>/dev/null || true
sleep 1

# Install Python dependencies
pip install quart hypercorn aiohttp aiomysql werkzeug beautifulsoup4 lxml python-dotenv cryptography > /dev/null 2>&1

echo "Starting Search engine..."
cd search-engine
hypercorn app:app --bind 127.0.0.1:5000 &
FLASK_PID=$!
cd ..

# Wait for Flask to start
echo "Waiting for backend to be ready..."
while ! nc -z localhost 5000; do   
  sleep 0.1
done
echo "Backend is ready!"

echo "Starting Browser..."
npm start &
ELECTRON_PID=$!

# Wait for Electron to exit
wait $ELECTRON_PID

# Cleanup when Electron exits
echo "Electron closed, stopping backend..."
kill $FLASK_PID