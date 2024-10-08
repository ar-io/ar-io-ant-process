const Arweave = require('arweave');
const path = require('path');
const fs = require('fs');
const { TurboFactory } = require('@ardrive/turbo-sdk');
const { createData, ArweaveSigner } = require('@dha-team/arbundles');

const changelog = `
# Changelog

### Changed

- Changed default landing page transaction ID.
`;

const srcCodeTxIdPlaceholder = '__INSERT_SOURCE_CODE_ID__';

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
  logging: false,
});

function getPublishedSourceCodeIds() {
  // Read all filenames from the changelogs directory
  const changeLogFileNames = fs.readdirSync(
    path.join(__dirname, '../changelogs'),
  );

  // Process each file name to extract the source code ID
  const txIds = changeLogFileNames
    .map((fileName) => {
      // Remove the date portion at the start, which is in the format YYYY-MM-DD-
      const parts = fileName.split('-').slice(3); // Skip the first 3 parts (YYYY, MM, DD)
      const idWithExtension = parts.join('-'); // Join the remaining parts in case the ID itself has dashes
      const txId = idWithExtension.split('.').shift(); // Remove the file extension (e.g., .md)

      return txId;
    })
    .filter((txId) => txId.length === 43); // Filter for valid IDs with length 43

  return txIds;
}
async function main() {
  // get the last published source code from the changelogs folder (can check the date on it, check for multiple dates) and
  // fetch the code from arweave, then compare it with the current code

  const publishedSourceCodeIds = getPublishedSourceCodeIds();
  const sourceCodeTransactions = await arweave.api
    .post('/graphql', {
      query: `{transactions(
        ids:[ ${publishedSourceCodeIds.map((id) => `"${id}"`).join(',')}]) {
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
      return res.data.data.transactions.edges
        .map((edge) => edge.node)
        .sort((a, b) => b.block.timestamp - a.block.timestamp);
    });

  const lastPublishedSourceCodeId = sourceCodeTransactions[0].tags.find(
    (tag) => tag.name === 'Original-Tx-Id',
  )?.value;

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
  let wallet = process.env.ARWEAVE_PUBLISHING_KEY;
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
  const address = await arweave.wallets.jwkToAddress(jwk);
  const signer = new ArweaveSigner(jwk);
  const turbo = TurboFactory.authenticated({ signer });

  const publishingTags = Object.entries({
    'App-Name': 'aos-LUA',
    'App-Version': '0.0.1',
    'Content-Type': 'text/x-lua',
    Author: 'Permanent Data Solutions',
    Changelog: changelog,
  }).map(([name, value]) => ({ name, value }));

  const data1 = await createData(bundledLua, signer, {
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

  const data2 = await createData(bundledLuaWithTxId, signer, {
    tags: [...publishingTags, { name: 'Original-Tx-Id', value: dataTx1.id }],
  });
  await data2.sign(signer);

  const dataTx2 = await turbo.uploadSignedDataItem({
    dataItemSizeFactory: () => data2.getRaw().byteLength,
    dataItemStreamFactory: () => data2.getRaw(),
  });

  // create changelog and write to changelogs folder
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  const changelogPath = path.join(
    __dirname,
    '../changelogs',
    `${formattedDate}-${dataTx2.id}.md`,
  );

  fs.writeFileSync(changelogPath, changelog, 'utf-8');

  fs.writeFileSync(
    path.join(__dirname, 'publish-output.json'),
    JSON.stringify({
      luaCodeTxId: dataTx2.id,
      changelog,
      publisherAddress: address,
    }),
    'utf-8',
  );
}
main();
