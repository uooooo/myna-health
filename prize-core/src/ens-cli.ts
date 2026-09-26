import { existsSync } from 'node:fs';
import { changeTextRole, inspectEns } from './ens.ts';

if (existsSync('.env')) process.loadEnvFile('.env');
const [command, name, key, delegate] = process.argv.slice(2);

try {
  if (command === 'inspect' && name) {
    console.log(JSON.stringify(await inspectEns(name, key), null, 2));
  } else if ((command === 'grant-text' || command === 'revoke-text') && name && key && delegate) {
    const privateKey = process.env.ENS_WRITE_PRIVATE_KEY;
    if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('ENS_WRITE_PRIVATE_KEY is required');
    console.log(JSON.stringify(await changeTextRole({
      name, key, delegate,
      mode: command === 'grant-text' ? 'grant' : 'revoke',
      privateKey: privateKey as `0x${string}`,
    }), null, 2));
  } else {
    throw new Error('Usage: bun run ens:inspect <name> [key] | bun run ens:grant-text <name> <key> <delegate> | bun run ens:revoke-text <name> <key> <delegate>');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
