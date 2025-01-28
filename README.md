# Arweave Name Token process on AO

This repository contains the source code used for Arweave Name Tokens used to resolve ArNS names on [AR.IO Gateways]. For official documentation on ANT's refer to the [ArNS ANT Docs]. For official documentation on ArNS refer to the [ArNS Docs].

This repository provides two flavours of ANT process module, AOS and a custom module.

<!-- toc -->

- [Setup](#setup)
  - [Install](#install)
  - [Testing](#testing)
  - [Building the AOS code](#building-the-aos-code)
    - [Build](#build)
      - [Lua code](#lua-code)
      - [Module WASM Binary](#module-wasm-binary)
    - [Publish](#publish)
      - [Lua code](#lua-code-1)
      - [Module WASM Binary](#module-wasm-binary-1)
    - [Load](#load)
      - [Lua code](#lua-code-2)
      - [Module WASM Binary](#module-wasm-binary-2)
    - [Spawn](#spawn)
      - [Lua code](#lua-code-3)
      - [Module WASM Binary](#module-wasm-binary-3)
- [Handler Methods](#handler-methods)
  - [Boot Methods](#boot-methods)
    - [`_boot` (WASM Binary only)](#_boot-wasm-binary-only)
  - [Read Methods](#read-methods)
    - [`Info`](#info)
    - [`Total-Supply`](#total-supply)
    - [`State`](#state)
    - [`Records`](#records)
    - [`Record`](#record)
    - [`Controllers`](#controllers)
    - [`Balance`](#balance)
    - [`Balances`](#balances)
  - [Write methods](#write-methods)
    - [`Transfer`](#transfer)
    - [`Set-Record`](#set-record)
    - [`Set-Name`](#set-name)
    - [`Set-Ticker`](#set-ticker)
    - [`Set-Description`](#set-description)
    - [`Set-Logo`](#set-logo)
    - [`Set-Keywords`](#set-keywords)
    - [`Add-Controller`](#add-controller)
    - [`Remove-Controller`](#remove-controller)
    - [`Remove-Record`](#remove-record)
    - [`Release-Name`](#release-name)
    - [`Reassign-Name`](#reassign-name)
- [Developers](#developers)
  - [Requirements](#requirements)
  - [Lua Setup](#lua-setup)
    - [With local script (MacOS and Linux only)](#with-local-script-macos-and-linux-only)
    - [Manually](#manually)
  - [aos](#aos)
  - [Code Formatting](#code-formatting)
  - [Testing](#testing-1)
  - [Dependencies](#dependencies)

<!-- tocstop -->

## Setup

### Install

First install the npm dependencies

```bash
yarn
```

Then install the ao cli - read the docs [here](https://github.com/permaweb/ao/tree/main/dev-cli)
Refer to the docs for installing different versions.

```sh
curl -L https://install_ao.g8way.io | bash
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

##### Lua code

```bash
yarn aos:build
```

##### Module WASM Binary

```bash
yarn module:build
```

#### Publish

Ensure that in the `tools` directory you place you Arweave JWK as `key.json`

##### Lua code

```bash
yarn aos:publish
```

##### Module WASM Binary

```bash
yarn module:publish
```

#### Load

This will load an AOS module into the loader, followed by the bundled aos Lua file to verify that it is a valid build.

##### Lua code

```bash
yarn aos:load
```

##### Module WASM Binary

```bash
yarn module:load
```

#### Spawn

This will spawn an aos process and load the bundled lua code into it.

##### Lua code

```bash
yarn aos:spawn
```

##### Module WASM Binary

```bash
yarn module:spawn
```

This will deploy the bundled lua file or WASM module to arweave as an L2 ([ANS-104]) transaction, so your wallet will need Turbo Credits to pay the gas.

## Handler Methods

For interacting with handlers please refer to the [AR.IO SDK] or the [AO Cookbook]

### Boot Methods

#### `_boot` (WASM Binary only)

When compiled as a WASM Module Binary the ANT provides a boot method to initialize the state of the ANT.

This will send a `Credit-Notice` to the initialized Owner (if applicable) and a `State-Notice` to the [ANT Registry].

If a valid JSON string state is provided, it will be used to set the initial state of the ANT.

Example:

```json
{
  "name": "Test Process",
  "ticker": "TEST",
  "description": "TEST DESCRIPTION",
  "keywords": ["KEYWORD-1", "KEYWORD-2", "KEYWORD-3"],
  "owner": "STUB_ADDRESS",
  "controllers": ["STUB_ADDRESS"],
  "balances": {
    "STUB_ADDRESS": 1
  },
  "records": {
    "@": {
      "transactionId": "3333333333333333333333333333333333333333333",
      "ttlSeconds": 900
    }
  }
}
```

### Read Methods

#### `Info`

Retrieves the Name, Ticker, Total supply, Logo, Denomination, and Owner of the ANT.

| Tag Name | Type   | Pattern | Required | Description                       |
| -------- | ------ | ------- | -------- | --------------------------------- |
| Action   | string | "Info"  | true     | Action tag for triggering handler |

#### `Total-Supply`

Retrieves total supply of the ANT.

| Tag Name | Type   | Pattern        | Required | Description                       |
| -------- | ------ | -------------- | -------- | --------------------------------- |
| Action   | string | "Total-Supply" | true     | Action tag for triggering handler |

#### `State`

Retrieves the entire state of the ANT, which includes:

- Records
- Controllers
- Balances
- Owner
- Name
- Ticker
- Logo
- Description
- Keywords
- Denomination
- TotalSupply
- Initialized

| Tag Name | Type   | Pattern | Required | Description                       |
| -------- | ------ | ------- | -------- | --------------------------------- |
| Action   | string | "State" | true     | Action tag for triggering handler |

#### `Records`

Retrieves all the records configured on the ANT

| Tag Name | Type   | Pattern   | Required | Description                       |
| -------- | ------ | --------- | -------- | --------------------------------- |
| Action   | string | "Records" | true     | Action tag for triggering handler |

#### `Record`

Retrieves and individual record by name.

| Tag Name   | Type   | Pattern                   | Required | Description                       |
| ---------- | ------ | ------------------------- | -------- | --------------------------------- |
| Action     | string | "Record"                  | true     | Action tag for triggering handler |
| Sub-Domain | string | "^(?:[a-zA-Z0-9_-]+\|@)$" | true     | Subdomain you which to read       |

#### `Controllers`

Retrieves all the controllers on the ANT.

| Tag Name | Type   | Pattern       | Required | Description                       |
| -------- | ------ | ------------- | -------- | --------------------------------- |
| Action   | string | "Controllers" | true     | Action tag for triggering handler |

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

#### `Set-Description`

Sets the description for the ANT.

| Tag Name    | Type   | Pattern            | Required | Description                       |
| ----------- | ------ | ------------------ | -------- | --------------------------------- |
| Action      | string | "Set-Description"  | true     | Action tag for triggering handler |
| Description | string | Max 512 characters | true     | New description for ANT.          |

#### `Set-Logo`

Sets the logo for the ANT.

| Tag Name | Type   | Pattern               | Required | Description                       |
| -------- | ------ | --------------------- | -------- | --------------------------------- |
| Action   | string | "Set-Logo"            | true     | Action tag for triggering handler |
| Logo     | string | "^[a-zA-Z0-9_-]{43}$" | true     | ID of new logo for ANT.           |

#### `Set-Keywords`

Sets the keywords for the ANT.

| Tag Name | Type   | Pattern                                                          | Required | Description                       |
| -------- | ------ | ---------------------------------------------------------------- | -------- | --------------------------------- |
| Action   | string | "Set-Keywords"                                                   | true     | Action tag for triggering handler |
| Keywords | table  | "^[%w-_#@]+$", max 32 characters, max 16 keywords, min 1 keyword | true     | New keywords for ANT.             |

#### `Add-Controller`

Adds a new controller to the ANT.

| Tag Name   | Type   | Pattern               | Required | Description                       |
| ---------- | ------ | --------------------- | -------- | --------------------------------- |
| Action     | string | "Add-Controller"      | true     | Action tag for triggering handler |
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

#### `Release-Name`

Calls the IO Network process to release the given ArNS name if that name is associated with the ANT.

| Tag Name | Type   | Pattern             | Required | Description                       |
| -------- | ------ | ------------------- | -------- | --------------------------------- |
| Action   | string | "Release-Name"      | true     | Action tag for triggering handler |
| Name     | string | "^([a-zA-Z0-9_-])$" | true     | ArNS name to release              |

#### `Reassign-Name`

Calls the IO Network process to reassign the given ArNS name to a new ANT ID if that name is associated with the ANT.

| Tag Name      | Type   | Pattern               | Required | Description                                          |
| ------------- | ------ | --------------------- | -------- | ---------------------------------------------------- |
| Action        | string | "Reassign-Name"       | true     | Action tag for triggering handler                    |
| IO-Process-Id | string | "^[a-zA-Z0-9_-]{43}$" | true     | ID of the IO Network Process to reassign the name on |
| Process-Id    | string | "^[a-zA-Z0-9_-]{43}$" | true     | ID of the new ANT to assign to the ArNS name         |
| Name          | string | "^([a-zA-Z0-9_-])$"   | true     | Subdomain of the record to remove.                   |

## Developers

### Requirements

- Lua 5.3 - [Download](https://www.lua.org/download.html)
- Luarocks - [Download](https://luarocks.org/)

### Lua Setup

#### With local script (MacOS and Linux only)

Note that we use lua 5.3 because that is what the [ao-dev-cli](https://github.com/permaweb/ao/tree/main/dev-cli) uses

1. Clone the repository and navigate to the project directory.
2. run the following:

```shell
yarn install-lua-deps
```

#### Manually

1. Build and install lua

```shell
curl -R -O https://lua.org/ftp/lua-5.3.1.tar.gz
tar -xzvf lua-5.3.1.tar.gz
cd lua-5.3.1
make
make install
```

2. Build and install LuaRocks

Note that we do not specify the lua version, it will discover it.

```shell
curl -R -O http://luarocks.github.io/luarocks/releases/luarocks-3.9.1.tar.gz
tar zxpf luarocks-3.9.1.tar.gz
cd luarocks-3.9.1
./configure --with-lua=/usr/local --with-lua-include=/usr/local/include
make build
sudo make install
```

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
- [AR.IO SDK]

[AR.IO Gateways]: https://docs.ar.io/gateways/ar-io-node/overview/
[AR.IO SDK]: https://www.npmjs.com/package/@ar.io/sdk
[ANT Registry]: https://github.com/ar-io/ar-io-ant-registry-process
[ArNS Docs]: https://ar.io/docs/arns/
[ArNS ANT Docs]: https://ar.io/docs/arns/#arweave-name-token-ant
[ArNS Portal]: https://arns.app
[AO Cookbook]: https://cookbook_ao.arweave.dev
