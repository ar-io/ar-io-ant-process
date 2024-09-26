const fs = require('fs');
const { AOProcess, IO, ANT, IO_TESTNET_PROCESS_ID } = require('@ar.io/sdk');
const { connect } = require('@permaweb/aoconnect');

const { toCsvSync } = require('@iwsio/json-csv-node');

const cleanSourceCodeId = 'RuoUVJOCJOvSfvvi_tn0UPirQxlYdC4_odqmORASP8g';

function createDomainLink(domain) {
  return `https://${domain}.arweave.net`;
}
function createEntityLink(processId) {
  return `https://www.ao.link/#/entity/${processId}`;
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
  for (const [domain, antId] of Object.entries(domainProcessIdMapping)) {
    try {
      console.log(
        `Processing domain ${scannedCount} / ${totalDomains}:`,
        `"${domain}"`,
      );
      const ant = ANT.init({ processId: antId });
      const state = await ant.getState();
      const sourceCodeId = state?.['Source-Code-TX-ID'];
      const owner = state?.Owner;
      if (owner && sourceCodeId && sourceCodeId !== cleanSourceCodeId) {
        affectedDomains.push({
          ['ArNS Domain']: createDomainLink(domain),
          ['Process ID']: createEntityLink(antId),
          ['Owner']: createEntityLink(owner),
        });
        console.log(
          `Domain ${domain} is detected to be affected, current affected domains count: ${Object.keys(affectedDomains).length}`,
        );
      }
      scannedCount++;
    } catch (error) {
      console.error('Error processing domain:', domain, error);
      affectedDomains.push({
        ['ArNS Domain']: createDomainLink(domain),
        ['Process ID']: createEntityLink(antId),
        ['Error']: 'Not reachable',
      });
    }
  }
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
        name: 'Owner',
        label: 'Owner',
      },
    ],
    fieldSeparator: ',',
    ignoreHeader: false,
  });

  fs.writeFileSync('affected-domains.csv', csv);
}

main();
