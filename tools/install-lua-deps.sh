#!/bin/bash

# Exit on error and enable debug mode
set -e
set -x

# Detect operating system
OS=$(uname -s)

# Lua and LuaRocks versions
LUA_VERSION="5.3.1"
LUAROCKS_VERSION="3.9.1"

install_dependencies() {
    case "$OS" in
        Darwin*)
            echo "Installing dependencies on macOS..."
            if ! command -v brew &> /dev/null; then
                echo "Homebrew not found. Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install gcc make curl readline
            ;;
        Linux*)
            echo "Installing dependencies on Linux..."
            if command -v apt-get &> /dev/null; then
                echo "Using apt-get to install dependencies..."
                sudo dpkg --remove-architecture i386 || true
                sudo apt-get update
                sudo apt-get install -y build-essential curl libreadline-dev
            elif command -v yum &> /dev/null; then
                echo "Using yum to install dependencies..."
                sudo yum groupinstall -y "Development Tools"
                sudo yum install -y curl readline-devel
            else
                echo "Unsupported Linux package manager. Please install build tools and curl manually."
                exit 1
            fi
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

    # Download Lua
    download_with_retry "https://www.lua.org/ftp/lua-${LUA_VERSION}.tar.gz" "lua-${LUA_VERSION}.tar.gz"

    # Extract and build
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
    esac

    cd ..
    rm -rf "lua-${LUA_VERSION}" "lua-${LUA_VERSION}.tar.gz"
    echo "Lua $LUA_VERSION installed successfully."
}

# Function to install LuaRocks
install_luarocks() {
    echo "Installing LuaRocks $LUAROCKS_VERSION..."

    # Download LuaRocks
    download_with_retry "https://luarocks.org/releases/luarocks-${LUAROCKS_VERSION}.tar.gz" "luarocks-${LUAROCKS_VERSION}.tar.gz"

    # Extract and configure
    tar -xzf "luarocks-${LUAROCKS_VERSION}.tar.gz"
    cd "luarocks-${LUAROCKS_VERSION}"

    ./configure --with-lua=/usr/local --with-lua-include=/usr/local/include
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
    echo "Starting installation process..."

    # Install dependencies
    install_dependencies

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

    echo "All installations completed successfully!"
}

# Run the main function
main
