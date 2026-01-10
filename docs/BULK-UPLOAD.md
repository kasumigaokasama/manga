# Bulk Upload Guide

This guide explains how to upload multiple manga chapters or books at once using the API.

## Prerequisites

1. A running Manga Shelf instance
2. An admin account or `ADMIN_TOKEN` configured in `.env`
3. Your manga files organized in a folder (PDF, EPUB, CBZ, or ZIP formats)

## API Endpoint

**POST** `/api/books/upload`

**Headers:**
- `Authorization: Bearer <jwt_token>` OR `ADMIN_TOKEN: <your_admin_token>`

**Form Data:**
- `file` (required): The file to upload
- `title` (required): Book/chapter title
- `author` (optional): Author name
- `language` (optional): Language code (e.g., `ja`, `en`, `de`)
- `tags` (optional): Comma-separated tags (e.g., `Manga, Drama, Psychological`)

**Rate Limit:** 5 uploads per 60 seconds per IP (configurable)

---

## Option 1: PowerShell (Windows)

Create a file `bulk-upload.ps1`:

```powershell
# Bulk Upload Script for Manga Shelf
# Usage: .\bulk-upload.ps1 -FolderPath "C:\Mangas\Series" -ServerUrl "http://localhost:8888"

param(
    [Parameter(Mandatory=$true)]
    [string]$FolderPath,

    [Parameter(Mandatory=$true)]
    [string]$ServerUrl,

    [Parameter(Mandatory=$false)]
    [string]$AdminToken = "",

    [Parameter(Mandatory=$false)]
    [string]$JwtToken = "",

    [Parameter(Mandatory=$false)]
    [string]$Author = "",

    [Parameter(Mandatory=$false)]
    [string]$Language = "",

    [Parameter(Mandatory=$false)]
    [string]$Tags = "",

    [Parameter(Mandatory=$false)]
    [int]$DelaySeconds = 15
)

# Validate authentication
if (-not $AdminToken -and -not $JwtToken) {
    Write-Error "You must provide either -AdminToken or -JwtToken"
    exit 1
}

# Get all supported files
$extensions = @("*.pdf", "*.epub", "*.cbz", "*.zip")
$files = @()
foreach ($ext in $extensions) {
    $files += Get-ChildItem -Path $FolderPath -Filter $ext -File
}

if ($files.Count -eq 0) {
    Write-Host "No supported files found in $FolderPath"
    exit 0
}

Write-Host "Found $($files.Count) files to upload"
Write-Host "Delay between uploads: $DelaySeconds seconds (to respect rate limits)"
Write-Host ""

$uploaded = 0
$failed = 0

foreach ($file in $files) {
    # Extract title from filename (remove extension)
    $title = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)

    Write-Host "[$($uploaded + $failed + 1)/$($files.Count)] Uploading: $title"

    try {
        # Build the multipart form
        $fileBytes = [System.IO.File]::ReadAllBytes($file.FullName)
        $fileEnc = [System.Text.Encoding]::GetEncoding('ISO-8859-1').GetString($fileBytes)

        $boundary = [System.Guid]::NewGuid().ToString()
        $LF = "`r`n"

        $bodyLines = @(
            "--$boundary",
            "Content-Disposition: form-data; name=`"title`"$LF",
            $title,
            "--$boundary",
            "Content-Disposition: form-data; name=`"file`"; filename=`"$($file.Name)`"",
            "Content-Type: application/octet-stream$LF",
            $fileEnc
        )

        # Add optional fields
        if ($Author) {
            $bodyLines = @("--$boundary", "Content-Disposition: form-data; name=`"author`"$LF", $Author) + $bodyLines
        }
        if ($Language) {
            $bodyLines = @("--$boundary", "Content-Disposition: form-data; name=`"language`"$LF", $Language) + $bodyLines
        }
        if ($Tags) {
            $bodyLines = @("--$boundary", "Content-Disposition: form-data; name=`"tags`"$LF", $Tags) + $bodyLines
        }

        $bodyLines += "--$boundary--$LF"
        $body = $bodyLines -join $LF

        # Build headers
        $headers = @{
            "Content-Type" = "multipart/form-data; boundary=$boundary"
        }
        if ($AdminToken) {
            $headers["ADMIN_TOKEN"] = $AdminToken
        } else {
            $headers["Authorization"] = "Bearer $JwtToken"
        }

        # Send request
        $response = Invoke-RestMethod -Uri "$ServerUrl/api/books/upload" `
            -Method Post `
            -Headers $headers `
            -Body $body

        Write-Host "  -> Success! Book ID: $($response.id)" -ForegroundColor Green
        $uploaded++

    } catch {
        Write-Host "  -> Failed: $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }

    # Delay to respect rate limits (skip on last file)
    if (($uploaded + $failed) -lt $files.Count) {
        Write-Host "  Waiting $DelaySeconds seconds..."
        Start-Sleep -Seconds $DelaySeconds
    }
}

Write-Host ""
Write-Host "=== Upload Complete ===" -ForegroundColor Cyan
Write-Host "Uploaded: $uploaded" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
```

**Usage:**

```powershell
# Using Admin Token
.\bulk-upload.ps1 `
    -FolderPath "C:\Mangas\Goodnight Punpun\PDFs" `
    -ServerUrl "http://localhost:8888" `
    -AdminToken "your-admin-token-here" `
    -Author "Inio Asano" `
    -Language "en" `
    -Tags "Manga, Drama, Psychological"

# Using JWT Token (login first via web UI, get token from browser DevTools)
.\bulk-upload.ps1 `
    -FolderPath "C:\Mangas\Series" `
    -ServerUrl "http://localhost:8888" `
    -JwtToken "eyJhbGciOiJIUzI1NiIs..."
```

---

## Option 2: Bash (Linux/macOS)

Create a file `bulk-upload.sh`:

```bash
#!/bin/bash
# Bulk Upload Script for Manga Shelf
# Usage: ./bulk-upload.sh /path/to/manga http://localhost:8888 --admin-token "your-token"

set -e

FOLDER_PATH=""
SERVER_URL=""
ADMIN_TOKEN=""
JWT_TOKEN=""
AUTHOR=""
LANGUAGE=""
TAGS=""
DELAY=15

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --admin-token) ADMIN_TOKEN="$2"; shift 2 ;;
        --jwt-token) JWT_TOKEN="$2"; shift 2 ;;
        --author) AUTHOR="$2"; shift 2 ;;
        --language) LANGUAGE="$2"; shift 2 ;;
        --tags) TAGS="$2"; shift 2 ;;
        --delay) DELAY="$2"; shift 2 ;;
        *)
            if [ -z "$FOLDER_PATH" ]; then
                FOLDER_PATH="$1"
            elif [ -z "$SERVER_URL" ]; then
                SERVER_URL="$1"
            fi
            shift
            ;;
    esac
done

# Validate
if [ -z "$FOLDER_PATH" ] || [ -z "$SERVER_URL" ]; then
    echo "Usage: $0 <folder_path> <server_url> --admin-token <token> [options]"
    echo "Options:"
    echo "  --admin-token <token>  Admin token for authentication"
    echo "  --jwt-token <token>    JWT token for authentication"
    echo "  --author <name>        Author name for all uploads"
    echo "  --language <code>      Language code (e.g., ja, en)"
    echo "  --tags <tags>          Comma-separated tags"
    echo "  --delay <seconds>      Delay between uploads (default: 15)"
    exit 1
fi

if [ -z "$ADMIN_TOKEN" ] && [ -z "$JWT_TOKEN" ]; then
    echo "Error: You must provide either --admin-token or --jwt-token"
    exit 1
fi

# Build auth header
if [ -n "$ADMIN_TOKEN" ]; then
    AUTH_HEADER="ADMIN_TOKEN: $ADMIN_TOKEN"
else
    AUTH_HEADER="Authorization: Bearer $JWT_TOKEN"
fi

# Find all supported files
FILES=$(find "$FOLDER_PATH" -maxdepth 1 -type f \( -iname "*.pdf" -o -iname "*.epub" -o -iname "*.cbz" -o -iname "*.zip" \) | sort)
TOTAL=$(echo "$FILES" | grep -c . || echo 0)

if [ "$TOTAL" -eq 0 ]; then
    echo "No supported files found in $FOLDER_PATH"
    exit 0
fi

echo "Found $TOTAL files to upload"
echo "Delay between uploads: ${DELAY}s"
echo ""

UPLOADED=0
FAILED=0
COUNT=0

while IFS= read -r filepath; do
    COUNT=$((COUNT + 1))
    filename=$(basename "$filepath")
    title="${filename%.*}"

    echo "[$COUNT/$TOTAL] Uploading: $title"

    # Build curl command
    CURL_ARGS=(
        -X POST
        -H "$AUTH_HEADER"
        -F "file=@$filepath"
        -F "title=$title"
    )

    [ -n "$AUTHOR" ] && CURL_ARGS+=(-F "author=$AUTHOR")
    [ -n "$LANGUAGE" ] && CURL_ARGS+=(-F "language=$LANGUAGE")
    [ -n "$TAGS" ] && CURL_ARGS+=(-F "tags=$TAGS")

    RESPONSE=$(curl -s -w "\n%{http_code}" "${CURL_ARGS[@]}" "$SERVER_URL/api/books/upload")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "201" ]; then
        BOOK_ID=$(echo "$BODY" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
        echo "  -> Success! Book ID: $BOOK_ID"
        UPLOADED=$((UPLOADED + 1))
    else
        echo "  -> Failed (HTTP $HTTP_CODE): $BODY"
        FAILED=$((FAILED + 1))
    fi

    # Delay (skip on last file)
    if [ "$COUNT" -lt "$TOTAL" ]; then
        echo "  Waiting ${DELAY}s..."
        sleep "$DELAY"
    fi
done <<< "$FILES"

echo ""
echo "=== Upload Complete ==="
echo "Uploaded: $UPLOADED"
echo "Failed: $FAILED"
```

**Usage:**

```bash
chmod +x bulk-upload.sh

# Using Admin Token
./bulk-upload.sh /home/user/mangas/series http://localhost:8888 \
    --admin-token "your-admin-token-here" \
    --author "Inio Asano" \
    --language "en" \
    --tags "Manga, Drama"

# Shorter delay (if rate limit is increased)
./bulk-upload.sh /path/to/manga http://localhost:8888 \
    --admin-token "token" \
    --delay 5
```

---

## Option 3: Node.js (Cross-Platform)

Create a file `bulk-upload.mjs`:

```javascript
#!/usr/bin/env node
// Bulk Upload Script for Manga Shelf
// Usage: node bulk-upload.mjs --folder /path/to/manga --url http://localhost:8888 --admin-token "token"

import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';

const { values: args } = parseArgs({
  options: {
    folder: { type: 'string', short: 'f' },
    url: { type: 'string', short: 'u' },
    'admin-token': { type: 'string' },
    'jwt-token': { type: 'string' },
    author: { type: 'string' },
    language: { type: 'string' },
    tags: { type: 'string' },
    delay: { type: 'string', default: '15' },
  },
});

const FOLDER = args.folder;
const SERVER_URL = args.url;
const ADMIN_TOKEN = args['admin-token'];
const JWT_TOKEN = args['jwt-token'];
const AUTHOR = args.author || '';
const LANGUAGE = args.language || '';
const TAGS = args.tags || '';
const DELAY = parseInt(args.delay || '15', 10) * 1000;

// Validate
if (!FOLDER || !SERVER_URL) {
  console.log(`Usage: node bulk-upload.mjs --folder <path> --url <server_url> --admin-token <token>

Options:
  --folder, -f      Path to folder containing manga files
  --url, -u         Server URL (e.g., http://localhost:8888)
  --admin-token     Admin token for authentication
  --jwt-token       JWT token for authentication
  --author          Author name for all uploads
  --language        Language code (e.g., ja, en)
  --tags            Comma-separated tags
  --delay           Delay between uploads in seconds (default: 15)`);
  process.exit(1);
}

if (!ADMIN_TOKEN && !JWT_TOKEN) {
  console.error('Error: You must provide either --admin-token or --jwt-token');
  process.exit(1);
}

const SUPPORTED_EXTENSIONS = ['.pdf', '.epub', '.cbz', '.zip'];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadFile(filePath, index, total) {
  const filename = path.basename(filePath);
  const title = path.parse(filename).name;

  console.log(`[${index + 1}/${total}] Uploading: ${title}`);

  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer]);

  formData.append('file', blob, filename);
  formData.append('title', title);
  if (AUTHOR) formData.append('author', AUTHOR);
  if (LANGUAGE) formData.append('language', LANGUAGE);
  if (TAGS) formData.append('tags', TAGS);

  const headers = {};
  if (ADMIN_TOKEN) {
    headers['ADMIN_TOKEN'] = ADMIN_TOKEN;
  } else {
    headers['Authorization'] = `Bearer ${JWT_TOKEN}`;
  }

  try {
    const response = await fetch(`${SERVER_URL}/api/books/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`  -> Success! Book ID: ${data.id}`);
      return true;
    } else {
      console.log(`  -> Failed (${response.status}): ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    console.log(`  -> Failed: ${error.message}`);
    return false;
  }
}

async function main() {
  // Get all supported files
  const files = fs.readdirSync(FOLDER)
    .filter(f => SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()))
    .map(f => path.join(FOLDER, f))
    .sort();

  if (files.length === 0) {
    console.log(`No supported files found in ${FOLDER}`);
    return;
  }

  console.log(`Found ${files.length} files to upload`);
  console.log(`Delay between uploads: ${DELAY / 1000}s`);
  console.log('');

  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const success = await uploadFile(files[i], i, files.length);
    if (success) uploaded++;
    else failed++;

    // Delay (skip on last file)
    if (i < files.length - 1) {
      console.log(`  Waiting ${DELAY / 1000}s...`);
      await sleep(DELAY);
    }
  }

  console.log('');
  console.log('=== Upload Complete ===');
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
```

**Usage:**

```bash
# Using Admin Token
node bulk-upload.mjs \
    --folder "/path/to/manga/pdfs" \
    --url "http://localhost:8888" \
    --admin-token "your-admin-token-here" \
    --author "Inio Asano" \
    --language "en" \
    --tags "Manga, Drama, Psychological"

# Windows (PowerShell)
node bulk-upload.mjs `
    --folder "C:\Mangas\Series\PDFs" `
    --url "http://localhost:8888" `
    --admin-token "your-token"
```

---

## Getting Your Authentication Token

### Option A: Admin Token (Recommended for Scripts)

**For local development:**

1. Edit `app/backend/.env`
2. Set a strong `ADMIN_TOKEN` (32+ characters):
   ```
   ADMIN_TOKEN=your-very-long-secure-admin-token-here-at-least-32-chars
   ```
3. Restart the backend
4. Use this token in your scripts

**For Docker deployments:**

1. Create a `.env` file in the `docker/` folder (or set environment variables):
   ```bash
   # docker/.env
   ADMIN_TOKEN=your-very-long-secure-admin-token-here-at-least-32-chars
   ```
2. Or pass it directly when starting the container:
   ```bash
   ADMIN_TOKEN=your-token docker compose up -d
   ```
3. Or add it to your `docker-compose.yml` override:
   ```yaml
   environment:
     - ADMIN_TOKEN=your-very-long-secure-admin-token-here
   ```
4. Restart the container:
   ```bash
   docker compose down && docker compose up -d
   ```

### Option B: JWT Token

1. Log in to the web UI as an admin/editor
2. Open browser DevTools (F12) -> Network tab
3. Make any API request (e.g., load library)
4. Find the `Authorization` header in the request
5. Copy the token (without "Bearer " prefix)

Note: JWT tokens expire, so Admin Token is preferred for bulk operations.

---

## Tips for Large Uploads

1. **Rate Limits**: Default is 5 uploads per 60 seconds. Use `--delay 15` (15 seconds) to stay under the limit. If you control the server, you can adjust the rate limit in `app/backend/src/routes/books.ts`.

2. **File Naming**: The script uses the filename (without extension) as the title. Name your files clearly:
   - `Goodnight Punpun Chapter 1.pdf` -> Title: "Goodnight Punpun Chapter 1"
   - `One Piece Vol 01.cbz` -> Title: "One Piece Vol 01"

3. **Consistent Metadata**: Use `--author`, `--language`, and `--tags` to apply the same metadata to all files in a batch.

4. **Resume Failed Uploads**: If uploads fail partway through, you can re-run the script. Duplicate titles are allowed (they'll create separate entries), so you may want to manually remove duplicates afterward.

5. **Large Files**: The default max upload size is 512MB. Adjust `MAX_UPLOAD_MB` in `.env` if needed.

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `401 Unauthorized` | Check your token is correct and hasn't expired |
| `413 Payload Too Large` | Increase `MAX_UPLOAD_MB` in backend `.env` |
| `429 Too Many Requests` | Increase delay between uploads |
| `ECONNREFUSED` | Ensure the server is running |
| `Timeout` | Large files may need longer timeout; try uploading individually |
