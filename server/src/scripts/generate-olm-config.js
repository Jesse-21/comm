// @flow

import olm from '@matrix-org/olm';
import fs from 'fs';
import path from 'path';
import uuid from 'uuid';

import { main } from './utils';

const olmConfigRelativePath = './secrets/olm_config.json';

async function generateOlmConfig() {
  await olm.init();
  const account = new olm.Account();
  account.create();
  const picklingKey = uuid.v4();
  const pickledAccount = account.pickle(picklingKey);

  const olmConfig = {
    picklingKey: picklingKey,
    pickledAccount: pickledAccount,
  };
  const scriptWorkingDirectory = path.resolve();

  if (!scriptWorkingDirectory.endsWith('comm/server')) {
    throw new Error('Script must be run in server directory in comm project.');
  }

  const olmConfigFilePath = path.join(
    scriptWorkingDirectory,
    olmConfigRelativePath,
  );

  fs.writeFileSync(olmConfigFilePath, JSON.stringify(olmConfig));
}

main([generateOlmConfig]);