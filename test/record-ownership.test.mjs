import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import pkg from '@permaweb/ao-loader';
const { createLoader } = pkg;
import { describe } from 'node:test';

const aos = readFileSync('./dist/aos-bundled.lua', 'utf-8');

describe('Record Ownership', async () => {
  test('should allow ANT owner to assign record ownership', async () => {
    const processId = 'test-process-001';
    const antOwner = 'ant-owner-address-123';
    const recordOwner = 'record-owner-address-456';
    
    // Create loader and evaluate ANT code
    const handle = await createLoader({ format: 'wasm64-unknown-emscripten-draft_2024_02_15' });
    const result = await handle({
      process: { id: processId, owner: antOwner, tags: [] },
      message: {
        Target: processId,
        From: antOwner,
        Owner: antOwner,
        ['Block-Height']: '1',
        Id: '1234',
        Module: 'module-id',
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: aos,
      },
      memory: null,
      spawn: {},
      env: {}
    });

    // Set a record with ownership
    const setRecordResult = await handle(
      result.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '1235',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'test' },
            { name: 'Transaction-Id', value: 'test-tx-id-789' },
            { name: 'TTL-Seconds', value: '900' },
            { name: 'Owner', value: recordOwner },
            { name: 'Name', value: 'Test Subdomain' },
            { name: 'Description', value: 'A test subdomain with ownership' }
          ],
        },
        env: {}
      }
    );

    // Verify record was created with ownership
    const recordResult = await handle(
      setRecordResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '1236',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Record' },
            { name: 'Sub-Domain', value: 'test' }
          ],
        },
        env: {}
      }
    );

    const record = JSON.parse(recordResult.Messages[0].Data);
    assert.equal(record.owner, recordOwner);
    assert.equal(record.name, 'Test Subdomain');
    assert.equal(record.description, 'A test subdomain with ownership');
  });

  test('should allow record owner to update their record', async () => {
    const processId = 'test-process-002';
    const antOwner = 'ant-owner-address-123';
    const recordOwner = 'record-owner-address-456';
    
    const handle = await createLoader({ format: 'wasm64-unknown-emscripten-draft_2024_02_15' });
    
    // Initialize ANT
    const initResult = await handle({
      process: { id: processId, owner: antOwner, tags: [] },
      message: {
        Target: processId,
        From: antOwner,
        Owner: antOwner,
        ['Block-Height']: '1',
        Id: '2001',
        Module: 'module-id',
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: aos,
      },
      memory: null,
      spawn: {},
      env: {}
    });

    // Create record with owner
    const createResult = await handle(
      initResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '2002',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'owned' },
            { name: 'Transaction-Id', value: 'initial-tx-id' },
            { name: 'TTL-Seconds', value: '900' },
            { name: 'Owner', value: recordOwner }
          ],
        },
        env: {}
      }
    );

    // Record owner updates their own record
    const updateResult = await handle(
      createResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: recordOwner,
          Owner: recordOwner,
          ['Block-Height']: '1',
          Id: '2003',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'owned' },
            { name: 'Transaction-Id', value: 'updated-tx-id' },
            { name: 'TTL-Seconds', value: '1800' },
            { name: 'Name', value: 'Updated by Owner' }
          ],
        },
        env: {}
      }
    );

    // Verify update succeeded
    const record = JSON.parse(updateResult.Messages[0].Data);
    assert.equal(record.transactionId, 'updated-tx-id');
    assert.equal(record.ttlSeconds, 1800);
    assert.equal(record.name, 'Updated by Owner');
    assert.equal(record.owner, recordOwner); // Owner unchanged
  });

  test('should allow ANT owner to transfer any record ownership', async () => {
    const processId = 'test-process-002b';
    const antOwner = 'ant-owner-address-123';
    const recordOwner = 'record-owner-address-456';
    const newOwner = 'new-owner-address-789';
    
    const handle = await createLoader({ format: 'wasm64-unknown-emscripten-draft_2024_02_15' });
    
    // Initialize and create owned record
    const initResult = await handle({
      process: { id: processId, owner: antOwner, tags: [] },
      message: {
        Target: processId,
        From: antOwner,
        Owner: antOwner,
        ['Block-Height']: '1',
        Id: '2501',
        Module: 'module-id',
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: aos,
      },
      memory: null,
      spawn: {},
      env: {}
    });

    const createResult = await handle(
      initResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '2502',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'godmode' },
            { name: 'Transaction-Id', value: 'godmode-tx-id' },
            { name: 'TTL-Seconds', value: '900' },
            { name: 'Owner', value: recordOwner }
          ],
        },
        env: {}
      }
    );

    // ANT owner transfers record they don't own (god mode)
    const transferResult = await handle(
      createResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,  // ANT owner, not record owner
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '2503',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Transfer-Record-Ownership' },
            { name: 'Sub-Domain', value: 'godmode' },
            { name: 'New-Owner', value: newOwner }
          ],
        },
        env: {}
      }
    );

    // Verify transfer succeeded
    assert(!transferResult.Messages[0].Tags.find(t => t.name === 'Error'), 'ANT owner should be able to transfer any record');
    const transferData = JSON.parse(transferResult.Messages[0].Data);
    assert.equal(transferData.previousOwner, recordOwner);
    assert.equal(transferData.newOwner, newOwner);
  });

  test('should allow controller to transfer any record ownership', async () => {
    const processId = 'test-process-002c';
    const antOwner = 'ant-owner-address-123';
    const controller = 'controller-address-999';
    const recordOwner = 'record-owner-address-456';
    const newOwner = 'new-owner-address-789';
    
    const handle = await createLoader({ format: 'wasm64-unknown-emscripten-draft_2024_02_15' });
    
    // Initialize with controller
    const initResult = await handle({
      process: { id: processId, owner: antOwner, tags: [] },
      message: {
        Target: processId,
        From: antOwner,
        Owner: antOwner,
        ['Block-Height']: '1',
        Id: '2601',
        Module: 'module-id',
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: aos,
      },
      memory: null,
      spawn: {},
      env: {}
    });

    // Add controller
    const addControllerResult = await handle(
      initResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '2602',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Add-Controller' },
            { name: 'Controller', value: controller }
          ],
        },
        env: {}
      }
    );

    // Create owned record
    const createResult = await handle(
      addControllerResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '2603',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'controllable' },
            { name: 'Transaction-Id', value: 'control-tx-id' },
            { name: 'TTL-Seconds', value: '900' },
            { name: 'Owner', value: recordOwner }
          ],
        },
        env: {}
      }
    );

    // Controller transfers record they don't own
    const transferResult = await handle(
      createResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: controller,  // Controller, not record owner
          Owner: controller,
          ['Block-Height']: '1',
          Id: '2604',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Transfer-Record-Ownership' },
            { name: 'Sub-Domain', value: 'controllable' },
            { name: 'New-Owner', value: newOwner }
          ],
        },
        env: {}
      }
    );

    // Verify transfer succeeded
    assert(!transferResult.Messages[0].Tags.find(t => t.name === 'Error'), 'Controller should be able to transfer any record');
    const transferData = JSON.parse(transferResult.Messages[0].Data);
    assert.equal(transferData.previousOwner, recordOwner);
    assert.equal(transferData.newOwner, newOwner);
  });

  test('should allow record owner to transfer ownership', async () => {
    const processId = 'test-process-003';
    const antOwner = 'ant-owner-address-123';
    const recordOwner = 'record-owner-address-456';
    const newOwner = 'new-owner-address-789';
    
    const handle = await createLoader({ format: 'wasm64-unknown-emscripten-draft_2024_02_15' });
    
    // Initialize and create owned record
    const initResult = await handle({
      process: { id: processId, owner: antOwner, tags: [] },
      message: {
        Target: processId,
        From: antOwner,
        Owner: antOwner,
        ['Block-Height']: '1',
        Id: '3001',
        Module: 'module-id',
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: aos,
      },
      memory: null,
      spawn: {},
      env: {}
    });

    const createResult = await handle(
      initResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '3002',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'transferable' },
            { name: 'Transaction-Id', value: 'transfer-tx-id' },
            { name: 'TTL-Seconds', value: '900' },
            { name: 'Owner', value: recordOwner }
          ],
        },
        env: {}
      }
    );

    // Transfer ownership
    const transferResult = await handle(
      createResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: recordOwner,
          Owner: recordOwner,
          ['Block-Height']: '1',
          Id: '3003',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Transfer-Record-Ownership' },
            { name: 'Sub-Domain', value: 'transferable' },
            { name: 'New-Owner', value: newOwner }
          ],
        },
        env: {}
      }
    );

    // Verify transfer
    const transferData = JSON.parse(transferResult.Messages[0].Data);
    assert.equal(transferData.previousOwner, recordOwner);
    assert.equal(transferData.newOwner, newOwner);
    
    // Verify ownership notice was sent
    const notice = transferResult.Messages.find(m => 
      m.Target === newOwner && 
      m.Tags.find(t => t.name === 'Action' && t.value === 'Record-Ownership-Transfer-Notice')
    );
    assert(notice, 'Ownership transfer notice should be sent to new owner');
  });

  test('should prevent non-owners from updating owned records', async () => {
    const processId = 'test-process-004';
    const antOwner = 'ant-owner-address-123';
    const recordOwner = 'record-owner-address-456';
    const randomUser = 'random-user-address-789';
    
    const handle = await createLoader({ format: 'wasm64-unknown-emscripten-draft_2024_02_15' });
    
    // Initialize and create owned record
    const initResult = await handle({
      process: { id: processId, owner: antOwner, tags: [] },
      message: {
        Target: processId,
        From: antOwner,
        Owner: antOwner,
        ['Block-Height']: '1',
        Id: '4001',
        Module: 'module-id',
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: aos,
      },
      memory: null,
      spawn: {},
      env: {}
    });

    const createResult = await handle(
      initResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '4002',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'protected' },
            { name: 'Transaction-Id', value: 'protected-tx-id' },
            { name: 'TTL-Seconds', value: '900' },
            { name: 'Owner', value: recordOwner }
          ],
        },
        env: {}
      }
    );

    // Attempt update by non-owner
    const updateResult = await handle(
      createResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: randomUser,
          Owner: randomUser,
          ['Block-Height']: '1',
          Id: '4003',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'protected' },
            { name: 'Transaction-Id', value: 'hacker-tx-id' },
            { name: 'TTL-Seconds', value: '100' }
          ],
        },
        env: {}
      }
    );

    // Should have error message
    const errorMsg = updateResult.Messages[0];
    assert(errorMsg.Tags.find(t => t.name === 'Error'), 'Should return error');
    assert(errorMsg.Data.includes('permission'), 'Error should mention permissions');
  });

  test('should allow ANT owner to revoke record ownership', async () => {
    const processId = 'test-process-revoke';
    const antOwner = 'ant-owner-123';
    const recordOwner = 'record-owner-456';
    
    const handle = await createLoader({ format: 'wasm64-unknown-emscripten-draft_2024_02_15' });
    
    // Initialize ANT
    const initResult = await handle({
      process: { id: processId, owner: antOwner, tags: [] },
      message: {
        Target: processId,
        From: antOwner,
        Owner: antOwner,
        ['Block-Height']: '1',
        Id: '1001',
        Module: 'module-id',
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: aos,
      },
      memory: null,
      spawn: {},
      env: {}
    });

    // Create record with owner
    const createResult = await handle(
      initResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '1002',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'revokable' },
            { name: 'Transaction-Id', value: 'revoke-tx-id' },
            { name: 'TTL-Seconds', value: '900' },
            { name: 'Owner', value: recordOwner }
          ],
        },
        env: {}
      }
    );

    // ANT owner revokes ownership
    const revokeResult = await handle(
      createResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '1003',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Revoke-Record-Ownership' },
            { name: 'Sub-Domain', value: 'revokable' }
          ],
        },
        env: {}
      }
    );

    // Verify revocation
    const revokeData = JSON.parse(revokeResult.Messages[0].Data);
    assert.equal(revokeData.subdomain, 'revokable');
    assert.equal(revokeData.previousOwner, recordOwner);
    assert.equal(revokeData.revoked, true);

    // Verify notice was sent to previous owner
    const notice = revokeResult.Messages.find(m => 
      m.Target === recordOwner && 
      m.Tags.find(t => t.name === 'Action' && t.value === 'Record-Ownership-Revoke-Notice')
    );
    assert(notice, 'Revocation notice should be sent to previous owner');
  });

  test('should prevent non-owners from revoking ownership', async () => {
    const processId = 'test-process-revoke-fail';
    const antOwner = 'ant-owner-123';
    const recordOwner = 'record-owner-456';
    const randomUser = 'random-user-789';
    
    const handle = await createLoader({ format: 'wasm64-unknown-emscripten-draft_2024_02_15' });
    
    // Initialize and create owned record
    const initResult = await handle({
      process: { id: processId, owner: antOwner, tags: [] },
      message: {
        Target: processId,
        From: antOwner,
        Owner: antOwner,
        ['Block-Height']: '1',
        Id: '2001',
        Module: 'module-id',
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: aos,
      },
      memory: null,
      spawn: {},
      env: {}
    });

    const createResult = await handle(
      initResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '2002',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'protected' },
            { name: 'Transaction-Id', value: 'protect-tx-id' },
            { name: 'TTL-Seconds', value: '900' },
            { name: 'Owner', value: recordOwner }
          ],
        },
        env: {}
      }
    );

    // Random user tries to revoke
    const revokeResult = await handle(
      createResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: randomUser,
          Owner: randomUser,
          ['Block-Height']: '1',
          Id: '2003',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Revoke-Record-Ownership' },
            { name: 'Sub-Domain', value: 'protected' }
          ],
        },
        env: {}
      }
    );

    // Should have error
    const errorMsg = revokeResult.Messages[0];
    assert(errorMsg.Tags.find(t => t.name === 'Error'), 'Should return error');
    assert(errorMsg.Data.includes('Sender is not the owner'), 'Error should mention owner requirement');
  });

  test('should allow record owner to set primary name for themselves only', async () => {
    const processId = 'test-process-primary';
    const antOwner = 'ant-owner-123';
    const recordOwner = 'record-owner-456';
    const ioProcessId = 'io-process-789';
    
    const handle = await createLoader({ format: 'wasm64-unknown-emscripten-draft_2024_02_15' });
    
    // Initialize and create owned record
    const initResult = await handle({
      process: { id: processId, owner: antOwner, tags: [] },
      message: {
        Target: processId,
        From: antOwner,
        Owner: antOwner,
        ['Block-Height']: '1',
        Id: '3001',
        Module: 'module-id',
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: aos,
      },
      memory: null,
      spawn: {},
      env: {}
    });

    const createResult = await handle(
      initResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '3002',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'myname' },
            { name: 'Transaction-Id', value: 'name-tx-id' },
            { name: 'TTL-Seconds', value: '900' },
            { name: 'Owner', value: recordOwner }
          ],
        },
        env: {}
      }
    );

    // Record owner approves primary name for themselves
    const approveResult = await handle(
      createResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: recordOwner,
          Owner: recordOwner,
          ['Block-Height']: '1',
          Id: '3003',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Approve-Primary-Name' },
            { name: 'Name', value: 'myname_testant' },
            { name: 'Recipient', value: recordOwner },
            { name: 'IO-Process-Id', value: ioProcessId }
          ],
        },
        env: {}
      }
    );

    // Should send approval to IO process
    const approvalMsg = approveResult.Messages.find(m => 
      m.Target === ioProcessId && 
      m.Tags.find(t => t.name === 'Action' && t.value === 'Approve-Primary-Name-Request')
    );
    assert(approvalMsg, 'Should send approval to IO process');
    assert.equal(approvalMsg.Tags.find(t => t.name === 'Name').value, 'myname_testant');
    assert.equal(approvalMsg.Tags.find(t => t.name === 'Recipient').value, recordOwner);
  });

  test('should prevent record owner from setting primary name for others', async () => {
    const processId = 'test-process-primary-fail';
    const antOwner = 'ant-owner-123';
    const recordOwner = 'record-owner-456';
    const someoneElse = 'someone-else-789';
    const ioProcessId = 'io-process-999';
    
    const handle = await createLoader({ format: 'wasm64-unknown-emscripten-draft_2024_02_15' });
    
    // Initialize and create owned record
    const initResult = await handle({
      process: { id: processId, owner: antOwner, tags: [] },
      message: {
        Target: processId,
        From: antOwner,
        Owner: antOwner,
        ['Block-Height']: '1',
        Id: '4001',
        Module: 'module-id',
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: aos,
      },
      memory: null,
      spawn: {},
      env: {}
    });

    const createResult = await handle(
      initResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '4002',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'secured' },
            { name: 'Transaction-Id', value: 'secure-tx-id' },
            { name: 'TTL-Seconds', value: '900' },
            { name: 'Owner', value: recordOwner }
          ],
        },
        env: {}
      }
    );

    // Record owner tries to approve primary name for someone else
    const approveResult = await handle(
      createResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: recordOwner,
          Owner: recordOwner,
          ['Block-Height']: '1',
          Id: '4003',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Approve-Primary-Name' },
            { name: 'Name', value: 'secured_testant' },
            { name: 'Recipient', value: someoneElse },
            { name: 'IO-Process-Id', value: ioProcessId }
          ],
        },
        env: {}
      }
    );

    // Should have error
    const errorMsg = approveResult.Messages[0];
    assert(errorMsg.Tags.find(t => t.name === 'Error'), 'Should return error');
    assert(errorMsg.Data.includes('not authorized'), 'Error should mention authorization');
  });

  test('should validate metadata fields', async () => {
    const processId = 'test-process-metadata';
    const antOwner = 'ant-owner-123';
    
    const handle = await createLoader({ format: 'wasm64-unknown-emscripten-draft_2024_02_15' });
    
    // Initialize ANT
    const initResult = await handle({
      process: { id: processId, owner: antOwner, tags: [] },
      message: {
        Target: processId,
        From: antOwner,
        Owner: antOwner,
        ['Block-Height']: '1',
        Id: '5001',
        Module: 'module-id',
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: aos,
      },
      memory: null,
      spawn: {},
      env: {}
    });

    // Test name too long
    const nameTooLongResult = await handle(
      initResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '5002',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'metadata1' },
            { name: 'Transaction-Id', value: 'meta-tx-id' },
            { name: 'TTL-Seconds', value: '900' },
            { name: 'Name', value: 'A'.repeat(51) } // Too long
          ],
        },
        env: {}
      }
    );

    assert(nameTooLongResult.Messages[0].Tags.find(t => t.name === 'Error'), 'Should error on name too long');

    // Test description too long
    const descTooLongResult = await handle(
      initResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '5003',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'metadata2' },
            { name: 'Transaction-Id', value: 'meta-tx-id2' },
            { name: 'TTL-Seconds', value: '900' },
            { name: 'Description', value: 'B'.repeat(513) } // Too long
          ],
        },
        env: {}
      }
    );

    assert(descTooLongResult.Messages[0].Tags.find(t => t.name === 'Error'), 'Should error on description too long');

    // Test too many keywords
    const tooManyKeywords = JSON.stringify(Array(17).fill('keyword'));
    const keywordResult = await handle(
      initResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '5004',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'metadata3' },
            { name: 'Transaction-Id', value: 'meta-tx-id3' },
            { name: 'TTL-Seconds', value: '900' },
            { name: 'Keywords', value: tooManyKeywords }
          ],
        },
        env: {}
      }
    );

    assert(keywordResult.Messages[0].Tags.find(t => t.name === 'Error'), 'Should error on too many keywords');
  });

  test('should maintain god mode for ANT owner', async () => {
    const processId = 'test-process-godmode';
    const antOwner = 'ant-owner-123';
    const recordOwner = 'record-owner-456';
    const controller = 'controller-789';
    
    const handle = await createLoader({ format: 'wasm64-unknown-emscripten-draft_2024_02_15' });
    
    // Initialize ANT with controller
    const initResult = await handle({
      process: { id: processId, owner: antOwner, tags: [] },
      message: {
        Target: processId,
        From: antOwner,
        Owner: antOwner,
        ['Block-Height']: '1',
        Id: '6001',
        Module: 'module-id',
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: aos,
      },
      memory: null,
      spawn: {},
      env: {}
    });

    // Add controller
    const addControllerResult = await handle(
      initResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '6002',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Add-Controller' },
            { name: 'Controller', value: controller }
          ],
        },
        env: {}
      }
    );

    // Create owned record
    const createResult = await handle(
      addControllerResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '6003',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'owned' },
            { name: 'Transaction-Id', value: 'owned-tx-id' },
            { name: 'TTL-Seconds', value: '900' },
            { name: 'Owner', value: recordOwner }
          ],
        },
        env: {}
      }
    );

    // ANT owner can still modify owned record
    const ownerUpdateResult = await handle(
      createResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '6004',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'owned' },
            { name: 'Transaction-Id', value: 'owner-updated-tx' },
            { name: 'TTL-Seconds', value: '1800' }
          ],
        },
        env: {}
      }
    );

    assert.equal(JSON.parse(ownerUpdateResult.Messages[0].Data).transactionId, 'owner-updated-tx');

    // Controller can also modify owned record
    const controllerUpdateResult = await handle(
      ownerUpdateResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: controller,
          Owner: controller,
          ['Block-Height']: '1',
          Id: '6005',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'owned' },
            { name: 'Transaction-Id', value: 'controller-updated-tx' },
            { name: 'TTL-Seconds', value: '3600' }
          ],
        },
        env: {}
      }
    );

    assert.equal(JSON.parse(controllerUpdateResult.Messages[0].Data).transactionId, 'controller-updated-tx');
  });

  test('should handle Set-Record-Metadata without requiring transactionId', async () => {
    // First create a record with metadata
    const createResult = await handle(
      initResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '7001',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'metarecord' },
            { name: 'Transaction-Id', value: 'original-tx-id' },
            { name: 'TTL-Seconds', value: '3600' },
            { name: 'Owner', value: recordOwner },
            { name: 'Record-Name', value: 'Original Name' },
            { name: 'Record-Description', value: 'Original description' }
          ],
        },
        env: {}
      }
    );

    assert(createResult.Messages[0].Tags.find(t => t.name === 'Action' && t.value === 'Set-Record-Notice'));

    // Update metadata only without providing transactionId or ttlSeconds
    const updateMetaResult = await handle(
      createResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: recordOwner,
          Owner: recordOwner,
          ['Block-Height']: '1',
          Id: '7002',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record-Metadata' },
            { name: 'Sub-Domain', value: 'metarecord' },
            { name: 'Record-Name', value: 'Updated Name' },
            { name: 'Record-Description', value: 'Updated description' },
            { name: 'Record-Keywords', value: JSON.stringify(['updated', 'metadata']) }
          ],
        },
        env: {}
      }
    );

    assert(updateMetaResult.Messages[0].Tags.find(t => t.name === 'Action' && t.value === 'Set-Record-Metadata-Notice'));
    const updatedRecord = JSON.parse(updateMetaResult.Messages[0].Data);
    
    // Check that metadata was updated
    assert.equal(updatedRecord.name, 'Updated Name');
    assert.equal(updatedRecord.description, 'Updated description');
    assert.deepEqual(updatedRecord.keywords, ['updated', 'metadata']);
    
    // Check that transactionId and ttlSeconds were preserved
    assert.equal(updatedRecord.transactionId, 'original-tx-id');
    assert.equal(updatedRecord.ttlSeconds, 3600);
    assert.equal(updatedRecord.owner, recordOwner);

    // Test that owner change requires ANT-level permission
    const ownerChangeResult = await handle(
      updateMetaResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: recordOwner,
          Owner: recordOwner,
          ['Block-Height']: '1',
          Id: '7003',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record-Metadata' },
            { name: 'Sub-Domain', value: 'metarecord' },
            { name: 'Owner', value: 'new-owner-address' }
          ],
        },
        env: {}
      }
    );

    assert(ownerChangeResult.Messages[0].Tags.find(t => t.name === 'Error'), 'Record owner should not be able to change ownership');

    // Test that ANT owner can change ownership via metadata update
    const antOwnerChangeResult = await handle(
      updateMetaResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '7004',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record-Metadata' },
            { name: 'Sub-Domain', value: 'metarecord' },
            { name: 'Owner', value: 'new-owner-address' }
          ],
        },
        env: {}
      }
    );

    assert(antOwnerChangeResult.Messages[0].Tags.find(t => t.name === 'Action' && t.value === 'Set-Record-Metadata-Notice'));
    assert.equal(JSON.parse(antOwnerChangeResult.Messages[0].Data).owner, 'new-owner-address');

    // Test updating non-existent record
    const nonExistentResult = await handle(
      antOwnerChangeResult.Memory,
      {
        process: { id: processId, owner: antOwner, tags: [] },
        message: {
          Target: processId,
          From: antOwner,
          Owner: antOwner,
          ['Block-Height']: '1',
          Id: '7005',
          Module: 'module-id',
          Tags: [
            { name: 'Action', value: 'Set-Record-Metadata' },
            { name: 'Sub-Domain', value: 'nonexistent' },
            { name: 'Record-Name', value: 'Should fail' }
          ],
        },
        env: {}
      }
    );

    assert(nonExistentResult.Messages[0].Tags.find(t => t.name === 'Error'), 'Should error on non-existent record');
  });
});