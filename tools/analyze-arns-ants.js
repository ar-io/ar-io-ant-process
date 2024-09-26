const fs = require('fs');
const { AOProcess, IO, ANT, IO_TESTNET_PROCESS_ID } = require('@ar.io/sdk');
const { connect } = require('@permaweb/aoconnect');
const { pLimit } = require('plimit-lit');
const { toCsvSync } = require('@iwsio/json-csv-node');

const cleanSourceCodeId = 'RuoUVJOCJOvSfvvi_tn0UPirQxlYdC4_odqmORASP8g';

function createDomainLink(domain) {
  return `https://${domain}.arweave.net`;
}
function createEntityLink(processId) {
  return `https://www.ao.link/#/entity/${processId}`;
}

async function getProcessEvalMessageIDsNotFromArIO(processId) {
  const messages = await fetch(
    `https://su-router.ao-testnet.xyz/${processId}?limit=100000`,
    {
      method: 'GET',
    },
  ).then((res) => res.json());
  const evalMessages = messages.edges.reduce((acc, edge) => {
    if (
      edge.node.message.tags.some(
        (tag) => tag.name === 'Action' && tag.value === 'Eval',
      ) &&
      !edge.node.message.tags.some((tag) => tag.name === 'Source-Code-TX-ID')
    ) {
      acc.push(edge.node.message.id);
    }
    return acc;
  }, []);
  return evalMessages;
}

async function main() {
  const aoClient = connect({
    CU_URL: 'https://cu.ar-io.dev',
  });
  const io = IO.init({
    process: new AOProcess({
      ao: aoClient,
      processId: IO_TESTNET_PROCESS_ID,
    }),
  });

  const arnsRecords = await io.getArNSRecords({
    limit: 3000,
  });

  const domainProcessIdMapping = arnsRecords.items.reduce(
    (acc, arnsNameRecord) => {
      acc[arnsNameRecord.name] = arnsNameRecord.processId;
      return acc;
    },
    {},
  );

  const affectedDomains = [];
  let totalDomains = Object.keys(domainProcessIdMapping).length;
  let scannedCount = 1;

  const limit = pLimit(30);
  async function analyze(domain, antId) {
    try {
      console.log(
        `Processing domain ${scannedCount} / ${totalDomains}:`,
        `"${domain}"`,
      );
      const ant = ANT.init({ processId: antId });
      const state = await ant.getState();
      const sourceCodeId = state?.['Source-Code-TX-ID'];
      const owner = state?.Owner;
      /**
       * - How many owners affected
       * - How many ants with custom evals not from ar-io
       */
      const messagesResult = await getProcessEvalMessageIDsNotFromArIO(
        antId,
      ).catch((e) => {
        console.error(e);
        return [];
      });

      if (owner && sourceCodeId && sourceCodeId !== cleanSourceCodeId) {
        affectedDomains.push({
          ['ArNS Domain']: domain,
          ['Process ID']: antId,
          ['Owner ID']: owner,
          ['Custom Eval Message Count']: messagesResult.length,
          ['ArNS Domain Link']: createDomainLink(domain),
          ['Process ID Link']: createEntityLink(antId),
          ['Owner Link']: createEntityLink(owner),
        });
        console.log(
          `Domain ${domain} is detected to be affected, current affected domains count: ${Object.keys(affectedDomains).length}`,
        );
      }
      scannedCount++;
    } catch (error) {
      console.error('Error processing domain:', domain, error);
      affectedDomains.push({
        ['ArNS Domain']: domain,
        ['Process ID']: antId,
        ['Owner ID']: 'unknown',
        ['Custom Eval Message Count']: 'unknown',
        ['ArNS Domain Link']: createDomainLink(domain),
        ['Process ID Link']: createEntityLink(antId),
        ['Owner Link']: 'unknown',
        ['Error']: 'Not reachable',
      });
    }
  }
  await Promise.all(
    Object.entries(domainProcessIdMapping).map(([domain, antId]) =>
      limit(() => analyze(domain, antId)),
    ),
  );

  affectedDomains.sort(
    (a, b) => a['Custom Eval Message Count'] - b['Custom Eval Message Count'],
  );

  // write json file
  fs.writeFileSync(
    'affected-domains.json',
    JSON.stringify(affectedDomains, null, 2),
  );
  // create csv
  const csv = toCsvSync(affectedDomains, {
    fields: [
      {
        name: 'ArNS Domain',
        label: 'ArNS Domain',
      },
      {
        name: 'Process ID',
        label: 'Process ID',
      },
      {
        name: 'Owner ID',
        label: 'Owner ID',
      },
      {
        name: 'Custom Eval Message Count',
        label: 'Custom Eval Message Count',
      },
      {
        name: 'ArNS Domain Link',
        label: 'ArNS Domain Link',
      },
      {
        name: 'Process ID Link',
        label: 'Process ID Link',
      },
      {
        name: 'Owner Link',
        label: 'Owner Link',
      },
    ],
    fieldSeparator: ',',
    ignoreHeader: false,
  });

  fs.writeFileSync('affected-domains.csv', csv);
}

main();
