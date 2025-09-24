#!/usr/bin/env bash
set -euo pipefail

# Simple backup script for Manga Shelf storage directory
# Edit STORAGE_DIR and BACKUP_DIR to your paths.

STORAGE_DIR="/opt/manga-shelf/storage"
BACKUP_DIR="/opt/backups"
STAMP=$(date +"%F_%H-%M-%S")
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/manga-shelf_$STAMP.tar.gz" -C "$STORAGE_DIR" .
echo "Backup written to $BACKUP_DIR/manga-shelf_$STAMP.tar.gz"

# Cron example (daily 03:30):
# 30 3 * * * /opt/manga-shelf/docs/backup.example.sh >> /var/log/manga-backup.log 2>&1

