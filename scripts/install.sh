#!/usr/bin/env sh
# Install bsd (better-swagger-diff CLI)
# Usage: curl -fsSL https://raw.githubusercontent.com/better-swagger-diff/better-swagger-diff/main/scripts/install.sh | sh

set -e

REPO="better-swagger-diff/better-swagger-diff"
BIN_NAME="bsd"
INSTALL_DIR="${BSD_INSTALL_DIR:-/usr/local/bin}"

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Darwin)  OS="darwin" ;;
  Linux)   OS="linux" ;;
  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64 | amd64) ARCH="x64" ;;
  arm64 | aarch64) ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

ASSET_NAME="bsd-${OS}-${ARCH}"

# Resolve latest release tag
if command -v curl >/dev/null 2>&1; then
  FETCH="curl -fsSL"
elif command -v wget >/dev/null 2>&1; then
  FETCH="wget -qO-"
else
  echo "curl or wget required"
  exit 1
fi

echo "Fetching latest release..."
LATEST_TAG="$($FETCH "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed 's/.*"tag_name": "\(.*\)".*/\1/')"

if [ -z "$LATEST_TAG" ]; then
  echo "Could not determine latest release tag"
  exit 1
fi

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${ASSET_NAME}"
CHECKSUMS_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/sha256sums.txt"

echo "Downloading ${BIN_NAME} ${LATEST_TAG} (${OS}/${ARCH})..."

TMP_FILE="$(mktemp)"
TMP_SUMS="$(mktemp)"
trap 'rm -f "$TMP_FILE" "$TMP_SUMS"' EXIT

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$DOWNLOAD_URL" -o "$TMP_FILE"
  curl -fsSL "$CHECKSUMS_URL" -o "$TMP_SUMS"
else
  wget -qO "$TMP_FILE" "$DOWNLOAD_URL"
  wget -qO "$TMP_SUMS" "$CHECKSUMS_URL"
fi

# Verify checksum
EXPECTED="$(grep "${ASSET_NAME}" "$TMP_SUMS" | awk '{print $1}')"
if [ -z "$EXPECTED" ]; then
  echo "Warning: could not find checksum for ${ASSET_NAME} in sha256sums.txt"
else
  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL="$(sha256sum "$TMP_FILE" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    ACTUAL="$(shasum -a 256 "$TMP_FILE" | awk '{print $1}')"
  else
    echo "Warning: cannot verify checksum (sha256sum/shasum not found)"
    ACTUAL=""
  fi

  if [ -n "$ACTUAL" ] && [ "$ACTUAL" != "$EXPECTED" ]; then
    echo "Checksum mismatch — aborting."
    echo "  expected: $EXPECTED"
    echo "  got:      $ACTUAL"
    exit 1
  fi
  echo "Checksum verified."
fi

chmod +x "$TMP_FILE"

# Install — try INSTALL_DIR, fall back to user-local
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP_FILE" "${INSTALL_DIR}/${BIN_NAME}"
elif command -v sudo >/dev/null 2>&1; then
  echo "Requesting sudo to install to ${INSTALL_DIR}..."
  sudo mv "$TMP_FILE" "${INSTALL_DIR}/${BIN_NAME}"
else
  LOCAL_BIN="$HOME/.local/bin"
  mkdir -p "$LOCAL_BIN"
  mv "$TMP_FILE" "${LOCAL_BIN}/${BIN_NAME}"
  INSTALL_DIR="$LOCAL_BIN"
  echo "Note: installed to ${INSTALL_DIR}. Add it to PATH if not already:"
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

echo "Installed ${BIN_NAME} to ${INSTALL_DIR}/${BIN_NAME}"
echo ""
"${INSTALL_DIR}/${BIN_NAME}" --version
