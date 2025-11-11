#!/bin/bash

###############################################################################
# NSXDC Rollback Script
# Restores project from a backup
# Usage: ./scripts/rollback.sh <backup-file>
###############################################################################

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     NSXDC Rollback Script v1.0         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if backup file is provided
if [ -z "$1" ]; then
  echo -e "${YELLOW}Available backups:${NC}"
  echo ""
  
  # List all backups
  if [ -d "backups" ]; then
    find backups -name "*.tar.gz" -type f | sort -r | while read -r backup; do
      SIZE=$(du -h "$backup" | cut -f1)
      DATE=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$backup" 2>/dev/null || stat -c "%y" "$backup" 2>/dev/null | cut -d'.' -f1)
      echo -e "  ${BLUE}•${NC} $backup (${SIZE}, ${DATE})"
    done
  else
    echo -e "${RED}No backups found. Create a backup first with: ./scripts/backup.sh${NC}"
    exit 1
  fi
  
  echo ""
  echo -e "${YELLOW}Usage:${NC}"
  echo "  ./scripts/rollback.sh <backup-file>"
  echo ""
  echo -e "${YELLOW}Example:${NC}"
  echo "  ./scripts/rollback.sh backups/nsxdc_20251111_143022.tar.gz"
  exit 0
fi

BACKUP_FILE="$1"

# Validate backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}Error: Backup file not found: ${BACKUP_FILE}${NC}"
  exit 1
fi

# Get backup info
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
BACKUP_DATE=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$BACKUP_FILE" 2>/dev/null || stat -c "%y" "$BACKUP_FILE" 2>/dev/null | cut -d'.' -f1)

echo -e "${YELLOW}Backup Information:${NC}"
echo "  File: ${BACKUP_FILE}"
echo "  Size: ${BACKUP_SIZE}"
echo "  Date: ${BACKUP_DATE}"
echo ""

# Warning and confirmation
echo -e "${RED}⚠️  WARNING: This will restore the project to the backup state.${NC}"
echo -e "${RED}   Current changes will be preserved in a pre-rollback backup.${NC}"
echo ""
read -p "Continue with rollback? (yes/no): " -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo -e "${YELLOW}Rollback cancelled.${NC}"
  exit 0
fi

echo ""
echo -e "${YELLOW}Step 1: Creating pre-rollback backup...${NC}"

# Create a backup before rollback
PRE_ROLLBACK_BACKUP="backups/pre-rollback_$(date +"%Y%m%d_%H%M%S").tar.gz"
mkdir -p backups

tar -czf "$PRE_ROLLBACK_BACKUP" \
  --exclude='node_modules' \
  --exclude='logs' \
  --exclude='data' \
  --exclude='.git' \
  --exclude='backups' \
  --exclude='dist' \
  --exclude='coverage' \
  . 2>/dev/null

PRE_SIZE=$(du -h "$PRE_ROLLBACK_BACKUP" | cut -f1)
echo -e "${GREEN}✓ Pre-rollback backup saved: ${PRE_ROLLBACK_BACKUP} (${PRE_SIZE})${NC}"

echo ""
echo -e "${YELLOW}Step 2: Extracting backup...${NC}"

# Get the top-level directory in the backup
BACKUP_ROOT=$(tar -tzf "$BACKUP_FILE" | head -1 | cut -f1 -d"/")

# Extract to temporary directory
TEMP_DIR=$(mktemp -d)
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Restore files (excluding node_modules, logs, data, .git, backups)
RESTORE_DIRS=("src" "public" "tests" "scripts" "docs")
RESTORE_FILES=("package.json" "tsconfig.json" "jest.config.js" "README.md" ".env.example")

for dir in "${RESTORE_DIRS[@]}"; do
  if [ -d "${TEMP_DIR}/${BACKUP_ROOT}/${dir}" ]; then
    echo "  Restoring directory: ${dir}"
    rm -rf "${dir}"
    cp -r "${TEMP_DIR}/${BACKUP_ROOT}/${dir}" "${dir}"
  fi
done

for file in "${RESTORE_FILES[@]}"; do
  if [ -f "${TEMP_DIR}/${BACKUP_ROOT}/${file}" ]; then
    echo "  Restoring file: ${file}"
    cp "${TEMP_DIR}/${BACKUP_ROOT}/${file}" "${file}"
  fi
done

# Clean up temp directory
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✓ Files restored${NC}"

echo ""
echo -e "${YELLOW}Step 3: Reinstalling dependencies...${NC}"

if [ -f "package.json" ]; then
  npm install --silent
  echo -e "${GREEN}✓ Dependencies installed${NC}"
else
  echo -e "${YELLOW}⚠️  No package.json found, skipping npm install${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Rollback Complete!                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "  • Project restored from: ${BACKUP_FILE}"
echo "  • Pre-rollback backup: ${PRE_ROLLBACK_BACKUP}"
echo "  • Dependencies reinstalled"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review restored files"
echo "  2. Run tests: npm test"
echo "  3. Start server: npm start"
echo ""
echo -e "${BLUE}If you need to undo this rollback, use: ./scripts/rollback.sh ${PRE_ROLLBACK_BACKUP}${NC}"
