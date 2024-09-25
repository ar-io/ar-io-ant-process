# Arweave Name Token process on AO

This repository contains the source code used for Arweave Name Tokens used to resolve ArNS names on [AR.IO Gateways]. For official documentation on ANT's refer to the [ArNS ANT Docs]. For official documentation on ArNS refer to the [ArNS Docs].

This repository provides two flavours of ANT process module, AOS and a custom module.

## Setup

### Install

First install the npm dependencies

```bash
yarn
```

Then install the ao cli - read the docs [here](https://github.com/permaweb/ao/tree/main/dev-cli)
Below is latest version as of writing, refer to the docs for the latest version.

```sh
curl -L https://arweave.net/iVthglhSN7G9LuJSU_h5Wy_lcEa0RE4VQmrtoBMj7Bw | bash
```

You may need to follow the instructions in the cli to add the program to your PATH.

### Testing

To test the module, you can use the following command to run [busted](https://lunarmodules.github.io/busted/)

```sh
busted .
```

### Building the AOS code

#### Build

This bundles the ant-aos code and outputs it to `dist` folder. This can then be used to send to the `Eval` method on AOS to load the ANT source code.

```bash
yarn aos:build
```

#### Publish

Ensure that in the `tools` directory you place you Arweave JWK as `key.json`

```bash
yarn aos:publish
```

#### Load

This will load an AOS module into the loader, followed by the bundled aos Lua file to verify that it is a valid build.

```bash
yarn aos:load
```

#### Spawn

this will spawn an aos process and load the bundled lua code into it.

```bash
yarn aos:spawn
```

This will deploy the bundled lua file to arweave as an L1 transaction, so your wallet will need AR to pay the gas.

### Building the custom module

Using the ao-dev-cli.

#### Build

This will compile the standalone ANT module to wasm, as a file named `process.wasm` and loads the module in [AO Loader](https://github.com/permaweb/ao/tree/main/loader) to validate the WASM program is valid.

```bash
yarn module:build
```

#### Publish

Publishes the custom ANT module to arweave - requires you placed your JWK in the `tools` directory. May require AR in the wallet to pay gas.

```sh
yarn module:publish
```

#### Load

Loads the module in [AO Loader](https://github.com/permaweb/ao/tree/main/loader) to validate the WASM program is valid.

```bash
yarn module:load
```

Requires `module:build` to have been called so that `process.wasm` exists.

#### Spawn

Spawns a process with the `process.wasm` file.

```bash
yarn module:spawn
```

## Handler Methods

For interacting with handlers please refer to the [AO Cookbook]

### Read Methods

#### `Info`

Retrieves the Name, Ticker, Total supply, Logo, Denomination, and Owner of the ANT.

| Tag Name | Type   | Pattern | Required | Description                       |
| -------- | ------ | ------- | -------- | --------------------------------- |
| Action   | string | "Info"  | true     | Action tag for triggering handler |

#### `Get-Records`

Retrieves all the records configured on the ANT

| Tag Name | Type   | Pattern       | Required | Description                       |
| -------- | ------ | ------------- | -------- | --------------------------------- |
| Action   | string | "Get-Records" | true     | Action tag for triggering handler |

#### `Get-Record`

Retrieves and individual record by name.

| Tag Name   | Type   | Pattern                   | Required | Description                       |
| ---------- | ------ | ------------------------- | -------- | --------------------------------- |
| Action     | string | "Get-Record"              | true     | Action tag for triggering handler |
| Sub-Domain | string | "^(?:[a-zA-Z0-9_-]+\|@)$" | true     | Subdomain you which to read       |

#### `Get-Controllers`

Retrieves all the controllers on the ANT.

| Tag Name | Type   | Pattern           | Required | Description                       |
| -------- | ------ | ----------------- | -------- | --------------------------------- |
| Action   | string | "Get-Controllers" | true     | Action tag for triggering handler |

#### `Balance`

Retrieves the balance of a target address.

| Tag Name  | Type   | Pattern               | Required | Description                       |
| --------- | ------ | --------------------- | -------- | --------------------------------- |
| Action    | string | "Balance"             | true     | Action tag for triggering handler |
| Recipient | string | "^[a-zA-Z0-9_-]{43}$" | false    | Address to retrieve balance for.  |

#### `Balances`

Retrieves all the balances of the ANT - with the standard implementation this will only contain the Owner of the ant with a balance of 1.

| Tag Name | Type   | Pattern    | Required | Description                       |
| -------- | ------ | ---------- | -------- | --------------------------------- |
| Action   | string | "Balances" | true     | Action tag for triggering handler |

### Write methods

#### `Transfer`

Transfers the ownership of the ANT.

| Tag Name  | Type   | Pattern               | Required | Description                       |
| --------- | ------ | --------------------- | -------- | --------------------------------- |
| Action    | string | "Transfer"            | true     | Action tag for triggering handler |
| Recipient | string | "^[a-zA-Z0-9_-]{43}$" | true     | Address to transfer ANT to.       |

#### `Set-Record`

Sets a record for a given subdomain.

| Tag Name       | Type   | Pattern                   | Required | Description                         |
| -------------- | ------ | ------------------------- | -------- | ----------------------------------- |
| Action         | string | "Set-Record"              | true     | Action tag for triggering handler   |
| Sub-Domain     | string | "^(?:[a-zA-Z0-9_-]+\|@)$" | true     | Subdomain to set the record for.    |
| Transaction-Id | string | "^[a-zA-Z0-9_-]{43}$"     | true     | Transaction ID for the record.      |
| TTL-Seconds    | number | Min: 900, Max: 2,592,000  | true     | Time-to-live in seconds for record. |

#### `Set-Name`

Sets the name of the ANT.

| Tag Name | Type   | Pattern    | Required | Description                       |
| -------- | ------ | ---------- | -------- | --------------------------------- |
| Action   | string | "Set-Name" | true     | Action tag for triggering handler |
| Name     | string | N/A        | true     | New name for the ANT.             |

#### `Set-Ticker`

Sets the ticker symbol for the ANT.

| Tag Name | Type   | Pattern      | Required | Description                       |
| -------- | ------ | ------------ | -------- | --------------------------------- |
| Action   | string | "Set-Ticker" | true     | Action tag for triggering handler |
| Ticker   | string | N/A          | true     | New ticker symbol for ANT.        |

#### `Set-Controller`

Adds a new controller to the ANT.

| Tag Name   | Type   | Pattern               | Required | Description                       |
| ---------- | ------ | --------------------- | -------- | --------------------------------- |
| Action     | string | "Set-Controller"      | true     | Action tag for triggering handler |
| Controller | string | "^[a-zA-Z0-9_-]{43}$" | true     | Address of the new controller.    |

#### `Remove-Controller`

Removes a controller from the ANT.

| Tag Name   | Type   | Pattern               | Required | Description                          |
| ---------- | ------ | --------------------- | -------- | ------------------------------------ |
| Action     | string | "Remove-Controller"   | true     | Action tag for triggering handler    |
| Controller | string | "^[a-zA-Z0-9_-]{43}$" | true     | Address of the controller to remove. |

#### `Remove-Record`

Removes a record from the ANT.

| Tag Name   | Type   | Pattern                   | Required | Description                        |
| ---------- | ------ | ------------------------- | -------- | ---------------------------------- |
| Action     | string | "Remove-Record"           | true     | Action tag for triggering handler  |
| Sub-Domain | string | "^(?:[a-zA-Z0-9_-]+\|@)$" | true     | Subdomain of the record to remove. |

## Developers

### Requirements

- Lua 5.3 - [Download](https://www.lua.org/download.html)
- Luarocks - [Download](https://luarocks.org/)

### Lua Setup (MacOS)

1. Clone the repository and navigate to the project directory.
1. Install `lua`
   - `brew install lua@5.3`
1. Add the following to your `.zshrc` or `.bashrc` file:

   ```bash
   echo 'export LDFLAGS="-L/usr/local/opt/lua@5.3/lib"' >> ~/.zshrc
   echo 'export CPPFLAGS="-I/usr/local/opt/lua@5.3/include"' >> ~/.zshrc
   echo 'export PKG_CONFIG_PATH="/usr/local/opt/lua@5.3/lib/pkgconfig"' >> ~/.zshrc
   echo 'export PATH="/usr/local/opt/lua@5.3/bin:$PATH"' >> ~/.zshrc
   ```

1. Run `source ~/.zshrc` or `source ~/.bashrc` to apply the changes.
1. Run `lua -v` to verify the installation.

### LuaRocks Setup

1. Install `luarocks`

   ```bash
   curl -R -O http://luarocks.github.io/luarocks/releases/luarocks-3.9.1.tar.gz
   tar zxpf luarocks-3.9.1.tar.gz
   cd luarocks-3.9.1
   ./configure --with-lua=/usr/local/opt/lua@5.3 --with-lua-include=/usr/local/opt/lua@5.3/include
   make build
   sudo make install
   ```

1. Check the installation by running `luarocks --version`.
1. Check the LuaRocks configuration by running `luarocks config | grep LUA`

If you ever need to refresh .luarocks, run the following command:

```sh
luarocks purge && luarocks install ar-io-ao-0.1-1.rockspec
```

### aos

To load the module into the `aos` REPL, run the following command:

```sh
aos --load src/main.lua
```

### Code Formatting

The code is formatted using `stylua`. To install `stylua`, run the following command:

```sh
cargo install stylua
stylua contract
```

### Testing

To run the tests, execute the following command:

```sh
busted .
```

To see the test coverage, run the following command:

```sh
luacov --reporter html && open luacov-html/index.html
```

### Dependencies

To add new dependencies, install using luarocks to the local directory

```sh
luarocks install <package>
```

And add the package to the `dependencies` table in the `ar-io-ao-0.1-1.rockspec` file.

```lua
-- rest of the file
dependencies = {
    "lua >= 5.3",
    "luaunit >= 3.3.0",
    "<package>"
}
```

# Additional Resources

- [AR.IO Gateways]
- [ArNS Docs]
- [ArNS Portal]
- [AO Cookbook]

[AR.IO Gateways]: https://docs.ar.io/gateways/ar-io-node/overview/
[ArNS Docs]: https://ar.io/docs/arns/
[ArNS ANT Docs]: https://ar.io/docs/arns/#arweave-name-token-ant
[ArNS Portal]: https://arns.app
[AO Cookbook]: https://cookbook_ao.arweave.dev
