#!/bin/sh
# GSV CLI Installer
# Usage: curl -sSL https://raw.githubusercontent.com/deathbyknowledge/gsv/main/install.sh | sh

set -e

REPO="deathbyknowledge/gsv"
INSTALL_DIR="${GSV_INSTALL_DIR:-$HOME/.local/bin}"

# Colors (if terminal supports them)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

info() {
  printf "${BLUE}info${NC}  %s\n" "$1"
}

success() {
  printf "${GREEN}success${NC}  %s\n" "$1"
}

warn() {
  printf "${YELLOW}warn${NC}  %s\n" "$1"
}

error() {
  printf "${RED}error${NC}  %s\n" "$1" >&2
  exit 1
}

# Detect OS
detect_os() {
  case "$(uname -s)" in
    Darwin) echo "darwin" ;;
    Linux) echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) error "Unsupported operating system: $(uname -s)" ;;
  esac
}

# Detect architecture
detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "x64" ;;
    arm64|aarch64) echo "arm64" ;;
    *) error "Unsupported architecture: $(uname -m)" ;;
  esac
}

# Get latest release version from GitHub
get_latest_version() {
  if command -v curl >/dev/null 2>&1; then
    curl -sL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/'
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/'
  else
    error "Neither curl nor wget found. Please install one of them."
  fi
}

# Download file
download() {
  url="$1"
  output="$2"
  
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$output"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$url" -O "$output"
  else
    error "Neither curl nor wget found."
  fi
}

main() {
  info "GSV CLI Installer"
  echo ""
  
  # Detect system
  OS=$(detect_os)
  ARCH=$(detect_arch)
  info "Detected: ${OS}-${ARCH}"
  
  # Get version
  VERSION="${GSV_VERSION:-$(get_latest_version)}"
  if [ -z "$VERSION" ]; then
    error "Could not determine latest version. Set GSV_VERSION manually."
  fi
  info "Version: ${VERSION}"
  
  # Construct download URL
  BINARY_NAME="gsv-${OS}-${ARCH}"
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY_NAME}.tar.gz"
  info "Downloading: ${DOWNLOAD_URL}"
  
  # Create temp directory
  TMP_DIR=$(mktemp -d)
  trap 'rm -rf "$TMP_DIR"' EXIT
  
  # Download
  download "$DOWNLOAD_URL" "$TMP_DIR/gsv.tar.gz" || error "Download failed. Check that version ${VERSION} exists and has ${BINARY_NAME}."
  
  # Extract
  tar -xzf "$TMP_DIR/gsv.tar.gz" -C "$TMP_DIR"
  
  # Create install directory if needed
  mkdir -p "$INSTALL_DIR"
  
  # Install
  mv "$TMP_DIR/$BINARY_NAME" "$INSTALL_DIR/gsv"
  chmod +x "$INSTALL_DIR/gsv"
  
  success "Installed gsv to ${INSTALL_DIR}/gsv"
  echo ""
  
  # Check if in PATH
  case ":$PATH:" in
    *":$INSTALL_DIR:"*)
      info "gsv is ready to use!"
      ;;
    *)
      warn "${INSTALL_DIR} is not in your PATH"
      echo ""
      echo "Add it to your shell profile:"
      echo ""
      echo "  # For bash (~/.bashrc or ~/.bash_profile)"
      echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
      echo ""
      echo "  # For zsh (~/.zshrc)"
      echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
      echo ""
      echo "  # For fish (~/.config/fish/config.fish)"
      echo "  fish_add_path \$HOME/.local/bin"
      echo ""
      ;;
  esac
  
  # Verify
  if [ -x "$INSTALL_DIR/gsv" ]; then
    echo ""
    info "Verifying installation..."
    "$INSTALL_DIR/gsv" --version || true
  fi
  
  echo ""
  success "Installation complete!"
  echo ""
  echo "Get started:"
  echo "  gsv --help"
  echo "  gsv config get"
  echo "  gsv client 'Hello!'"
}

main "$@"
