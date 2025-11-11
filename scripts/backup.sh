#!/bin/bash

# NSXDC Backup Script
# Creates a timestamped backup of the entire project

PHASE=$1
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -z "$PHASE" ]; then
  echo "Usage: ./scripts/backup.sh <phase-name>"
  echo "Example: ./scripts/backup.sh phase-1"
  exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR/$PHASE"

# Backup filename
BACKUP_FILE="$BACKUP_DIR/$PHASE/nsxdc-$PHASE-$TIMESTAMP.tar.gz"

echo "📦 Creating backup: $BACKUP_FILE"

# Create tarball (exclude node_modules, logs, data, and backups)
tar -czf "$BACKUP_FILE" \
  --exclude='node_modules' \
  --exclude='logs' \
  --exclude='data' \
  --exclude='backups' \
  --exclude='.git' \
  --exclude='coverage' \
  --exclude='dist' \
  src/ public/ tests/ package.json tsconfig.json .env README.md

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ Backup created successfully: $BACKUP_FILE ($SIZE)"
  echo "📍 Location: $(pwd)/$BACKUP_FILE"
else
  echo "❌ Backup failed"
  exit 1
fi
