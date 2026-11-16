#!/bin/bash
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
echo "Starting CUEFRAME Workbench at http://localhost:5173 ..."
open "http://localhost:5173" &
npm run dev -- --port 5173
