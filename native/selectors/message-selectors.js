// @flow

import { createSelector } from 'reselect';

import type { ThreadMessageInfo } from 'lib/types/message-types';

import { activeThreadSelector } from '../navigation/nav-selectors';
import type { AppState } from '../redux/redux-setup';
import type { NavPlusRedux } from '../types/selector-types';

const msInHour = 60 * 60 * 1000;

const nextMessagePruneTimeSelector: (
  state: AppState,
) => ?number = createSelector(
  (state: AppState) => state.messageStore.threads,
  (threadMessageInfos: { [id: string]: ThreadMessageInfo }): ?number => {
    let nextTime;
    for (let threadID in threadMessageInfos) {
      const threadMessageInfo = threadMessageInfos[threadID];
      const threadPruneTime = Math.max(
        threadMessageInfo.lastNavigatedTo + msInHour,
        threadMessageInfo.lastPruned + msInHour * 6,
      );
      if (nextTime === undefined || threadPruneTime < nextTime) {
        nextTime = threadPruneTime;
      }
    }
    return nextTime;
  },
);

const pruneThreadIDsSelector: (
  input: NavPlusRedux,
) => () => $ReadOnlyArray<string> = createSelector(
  (input: NavPlusRedux) => input.redux.messageStore.threads,
  (input: NavPlusRedux) => activeThreadSelector(input.navContext),
  (
    threadMessageInfos: { [id: string]: ThreadMessageInfo },
    activeThread: ?string,
  ) => (): $ReadOnlyArray<string> => {
    const now = Date.now();
    const threadIDsToPrune = [];
    for (let threadID in threadMessageInfos) {
      if (threadID === activeThread) {
        continue;
      }
      const threadMessageInfo = threadMessageInfos[threadID];
      if (
        threadMessageInfo.lastNavigatedTo + msInHour < now &&
        threadMessageInfo.lastPruned + msInHour * 6 < now
      ) {
        threadIDsToPrune.push(threadID);
      }
    }
    return threadIDsToPrune;
  },
);

export { nextMessagePruneTimeSelector, pruneThreadIDsSelector };
