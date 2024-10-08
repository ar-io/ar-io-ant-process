const Arweave = require('arweave');
const path = require('path');
const fs = require('fs');
const { TurboFactory } = require('@ardrive/turbo-sdk');
const { createData, ArweaveSigner } = require('@dha-team/arbundles');

const srcCodeTxIdPlaceholder = '__INSERT_SOURCE_CODE_ID__';

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
  logging: false,
});

function getPublishedSourceCodeIds() {
  const changelog = fs.readFileSync(
    path.join(__dirname, '../CHANGELOG.md'),
    'utf-8',
  );

  const sourceCodeTxIdRegex = /[a-zA-Z0-9-_]{43}/g;
  const matches = changelog.match(sourceCodeTxIdRegex);

  const sourceCodeTxIds = new Set(matches ?? []);

  return [...sourceCodeTxIds];
}
async function main() {
  // get the last published source code from the changelogs folder (can check the date on it, check for multiple dates) and
  // fetch the code from arweave, then compare it with the current code

  const publishedSourceCodeIds = getPublishedSourceCodeIds();
  const lastPublishedSourceCodeId = await arweave.api
    .post('/graphql', {
      query: `{
      transactions(
        first: 1
        sort: HEIGHT_DESC
        ids: [${publishedSourceCodeIds.map((id) => `"${id}"`).join(',')}]
      ) {
        edges {
          node {
            id
            tags {
              name
              value
            }
            block {
              timestamp
            }
          }
        }
      }
    }`,
    })
    .then((res) => {
      // TODO: add pagination once we have more than 100 versions
      if (res.data.data.transactions.edges.length > 99)
        throw new Error('Too many transactions found, implement pagination');
      return res.data.data.transactions.edges[0].node.tags.find(
        (tag) => tag.name === 'Original-Tx-Id',
      )?.value;
    });

  const lastPublishedSourceCode = await arweave.transactions
    .getData(lastPublishedSourceCodeId, { decode: true, string: true })
    .catch((error) => {
      console.error(
        'Error fetching last published source code, unable to compare with current code. \n',
        error,
      );
    });

  const bundledLua = fs.readFileSync(
    path.join(__dirname, '../dist/aos-bundled.lua'),
    'utf-8',
  );

  if (lastPublishedSourceCode === bundledLua) {
    console.log('No changes in source code detected, skipping publishing');
    process.exit(0); // Exit with code 0 to indicate success
  }
  let wallet = process.env.WALLET;
  if (!wallet) {
    try {
      wallet = fs.readFileSync(path.join(__dirname, 'key.json'), 'utf-8');
    } catch (error) {
      console.error(
        'No key found, please set ARWEAVE_PUBLISHING_KEY environment variable or provide a key.json file',
      );
      return;
    }
  }
  const jwk = JSON.parse(wallet);
  const signer = new ArweaveSigner(jwk);
  const turbo = TurboFactory.authenticated({ signer });

  const publishingTags = Object.entries({
    'App-Name': 'aos-LUA',
    'App-Version': '8',
    'Content-Type': 'text/x-lua',
    Author: 'Permanent Data Solutions',
    'Git-Hash': process.env.GITHUB_SHA,
  }).map(([name, value]) => ({ name, value }));

  const data1 = createData(bundledLua, signer, {
    tags: publishingTags,
  });
  await data1.sign(signer);
  const dataTx1 = await turbo.uploadSignedDataItem({
    dataItemSizeFactory: () => data1.getRaw().byteLength,
    dataItemStreamFactory: () => data1.getRaw(),
  });

  // replace placeholder with actual tx id
  const bundledLuaWithTxId = bundledLua.replace(
    srcCodeTxIdPlaceholder,
    dataTx1.id,
  );

  const data2 = createData(bundledLuaWithTxId, signer, {
    tags: [...publishingTags, { name: 'Original-Tx-Id', value: dataTx1.id }],
  });
  await data2.sign(signer);

  const dataTx2 = await turbo.uploadSignedDataItem({
    dataItemSizeFactory: () => data2.getRaw().byteLength,
    dataItemStreamFactory: () => data2.getRaw(),
  });

  console.log('publishedLuaTxId.' + dataTx2.id);

  // log out lua source code to be consumed in action
  // console.log(`luaSourceCode{{{${bundledLuaWithTxId}}}}`);
}
main();
