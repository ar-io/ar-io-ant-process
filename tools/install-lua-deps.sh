#!/bin/bash

set -e

# Detect operating system
OS=$(uname -s)

# Lua and LuaRocks versions
LUA_VERSION="5.3.1"
LUAROCKS_VERSION="3.9.1"

# Function to provide dependency links
provide_dependency_links() {
    case "$OS" in
        Darwin*)
            echo " Please ensure you have the following installed on macOS:\n"
            echo "- Homebrew: https://brew.sh/"
            echo "Run these commands to install dependencies on macOS:"
            echo "  brew install gcc make curl readline\n\n"
            ;;
        Linux*)
            echo " Please ensure you have the following installed on Linux:\n"
            echo "- GCC, Make, and Curl: Typically included in build-essential."
            echo "- Readline development libraries."
            echo "For Ubuntu/Debian, run:"
            echo "  sudo apt-get install -y build-essential curl libreadline-dev"
            echo "For CentOS/RHEL, run:"
            echo "  sudo yum groupinstall -y 'Development Tools' && sudo yum install -y readline-devel curl"
            echo "For Arch Linux, run:"
            echo "  sudo pacman -Syu --noconfirm base-devel curl readline\n\n"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            echo " Please ensure you have the following installed on Windows:"
            echo "- MSYS2: https://www.msys2.org/"
            echo "Once MSYS2 is installed, use pacman to install dependencies:"
            echo "  pacman -Syu --noconfirm mingw-w64-x86_64-toolchain mingw-w64-x86_64-curl mingw-w64-x86_64-readline"
            ;;
        *)
            echo "Unsupported operating system: $OS"
            exit 1
            ;;
    esac
}

# Function to download with retry
download_with_retry() {
    local url="$1"
    local output="$2"
    local max_attempts=3
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        echo "Downloading $url (Attempt $attempt)..."
        if curl -L -o "$output" "$url"; then
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done

    echo "Failed to download $url after $max_attempts attempts"
    exit 1
}

# Function to install Lua
install_lua() {
    echo "Installing Lua $LUA_VERSION..."

    download_with_retry "https://www.lua.org/ftp/lua-${LUA_VERSION}.tar.gz" "lua-${LUA_VERSION}.tar.gz"
    tar -xzf "lua-${LUA_VERSION}.tar.gz"
    cd "lua-${LUA_VERSION}"

    case "$OS" in
        Darwin*)
            make macosx
            sudo make install
            ;;
        Linux*)
            make linux
            sudo make install
            ;;
        MINGW*|MSYS*|CYGWIN*)
            make mingw
            make install
            ;;
    esac

    cd ..
    rm -rf "lua-${LUA_VERSION}" "lua-${LUA_VERSION}.tar.gz"
    echo "Lua $LUA_VERSION installed successfully."
}

# Function to install LuaRocks
install_luarocks() {
    echo "Installing LuaRocks $LUAROCKS_VERSION..."

    download_with_retry "https://luarocks.org/releases/luarocks-${LUAROCKS_VERSION}.tar.gz" "luarocks-${LUAROCKS_VERSION}.tar.gz"
    tar -xzf "luarocks-${LUAROCKS_VERSION}.tar.gz"
    cd "luarocks-${LUAROCKS_VERSION}"

    case "$OS" in
        Darwin*|Linux*)
            ./configure --with-lua=/usr/local --with-lua-include=/usr/local/include
            ;;
        MINGW*|MSYS*|CYGWIN*)
            ./configure --with-lua=/mingw64 --with-lua-include=/mingw64/include
            ;;
    esac

    make build
    sudo make install

    cd ..
    rm -rf "luarocks-${LUAROCKS_VERSION}" "luarocks-${LUAROCKS_VERSION}.tar.gz"
    echo "LuaRocks $LUAROCKS_VERSION installed successfully."
}

# Function to check if Lua is installed
is_lua_installed() {
    command -v lua &> /dev/null && lua -v 2>&1 | grep -q "${LUA_VERSION}"
}

# Function to check if LuaRocks is installed
is_luarocks_installed() {
    command -v luarocks &> /dev/null && luarocks --version 2>&1 | grep -q "${LUAROCKS_VERSION}"
}

# Main function
main() {
    echo "Starting installation process...\n\n"

    # Provide dependency links
    provide_dependency_links

    # Install Lua if not already installed
    if ! is_lua_installed; then
        install_lua
    else
        echo "Lua $LUA_VERSION is already installed."
    fi

    # Install LuaRocks if not already installed
    if ! is_luarocks_installed; then
        install_luarocks
    else
        echo "LuaRocks $LUAROCKS_VERSION is already installed."
    fi

    echo "\nAll installations completed successfully!"
}

# Run main
main
