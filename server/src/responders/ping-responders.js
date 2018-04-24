// @flow

import type { PingRequest, PingResponse } from 'lib/types/ping-types';
import { defaultNumberPerThread } from 'lib/types/message-types';
import type { Viewer } from '../session/viewer';
import { serverRequestTypes } from 'lib/types/request-types';
import { isDeviceType, assertDeviceType } from 'lib/types/device-types';

import t from 'tcomb';
import invariant from 'invariant';

import { ServerError } from 'lib/utils/errors';
import { mostRecentMessageTimestamp } from 'lib/shared/message-utils';
import { mostRecentUpdateTimestamp } from 'lib/shared/update-utils';

import { validateInput, tShape, tPlatform } from '../utils/validation-utils';
import { entryQueryInputValidator } from './entry-responders';
import { fetchMessageInfosSince } from '../fetchers/message-fetchers';
import { verifyThreadID, fetchThreadInfos } from '../fetchers/thread-fetchers';
import { fetchEntryInfos } from '../fetchers/entry-fetchers';
import { updateActivityTime } from '../updaters/activity-updaters';
import { fetchCurrentUserInfo } from '../fetchers/user-fetchers';
import { fetchUpdateInfos } from '../fetchers/update-fetchers';
import { recordDeliveredUpdate, setCookiePlatform } from '../session/cookies';
import { deviceTokenUpdater } from '../updaters/device-token-updaters';

const pingRequestInputValidator = tShape({
  calendarQuery: entryQueryInputValidator,
  lastPing: t.maybe(t.Number), // deprecated
  messagesCurrentAsOf: t.maybe(t.Number),
  updatesCurrentAsOf: t.maybe(t.Number),
  watchedIDs: t.list(t.String),
  clientResponses: t.maybe(t.list(
    tShape({
      type: t.irreducible(
        'serverRequestTypes.PLATFORM',
        x => x === serverRequestTypes.PLATFORM,
      ),
      platform: tPlatform,
    }),
  )),
});

async function pingResponder(
  viewer: Viewer,
  input: any,
): Promise<PingResponse> {
  const request: PingRequest = input;
  validateInput(pingRequestInputValidator, request);

  let clientMessagesCurrentAsOf;
  if (
    request.messagesCurrentAsOf !== null &&
    request.messagesCurrentAsOf !== undefined
  ) {
    clientMessagesCurrentAsOf = request.messagesCurrentAsOf;
  } else if (request.lastPing !== null && request.lastPing !== undefined) {
    clientMessagesCurrentAsOf = request.lastPing;
  }
  if (
    clientMessagesCurrentAsOf === null ||
    clientMessagesCurrentAsOf === undefined
  ) {
    throw new ServerError('invalid_parameters');
  }

  const navID = request.calendarQuery.navID;
  let validNav = navID === "home";
  if (!validNav) {
    validNav = await verifyThreadID(navID);
  }
  if (!validNav) {
    throw new ServerError('invalid_parameters');
  }

  const threadCursors = {};
  for (let watchedThreadID of request.watchedIDs) {
    threadCursors[watchedThreadID] = null;
  }
  const threadSelectionCriteria = { threadCursors, joinedThreads: true };

  const clientResponsePromises = [];
  let viewerMissingPlatform = !viewer.platform;
  let viewerMissingDeviceToken =
    isDeviceType(viewer.platform) && viewer.loggedIn && !viewer.deviceToken;
  if (request.clientResponses) {
    for (let clientResponse of request.clientResponses) {
      if (clientResponse.type === serverRequestTypes.PLATFORM) {
        clientResponsePromises.push(setCookiePlatform(
          viewer.cookieID,
          clientResponse.platform,
        ));
        viewerMissingPlatform = false;
      } else if (clientResponse.type === serverRequestTypes.DEVICE_TOKEN) {
        clientResponsePromises.push(deviceTokenUpdater(
          viewer,
          {
            deviceToken: clientResponse.deviceToken,
            deviceType: assertDeviceType(viewer.platform),
          },
        ));
        viewerMissingDeviceToken = false;
      }
    }
  }

  const [
    messagesResult,
    threadsResult,
    entriesResult,
    currentUserInfo,
    newUpdates,
  ] = await Promise.all([
    fetchMessageInfosSince(
      viewer,
      threadSelectionCriteria,
      clientMessagesCurrentAsOf,
      defaultNumberPerThread,
    ),
    fetchThreadInfos(viewer),
    fetchEntryInfos(viewer, request.calendarQuery),
    fetchCurrentUserInfo(viewer),
    request.updatesCurrentAsOf
      ? fetchUpdateInfos(viewer, request.updatesCurrentAsOf)
      : null,
    clientResponsePromises.length > 0
      ? Promise.all(clientResponsePromises)
      : null,
  ]);

  let updatesResult = null;
  const timestampUpdatePromises = [ updateActivityTime(viewer) ];
  if (newUpdates) {
    invariant(request.updatesCurrentAsOf, "should be set");
    const updatesCurrentAsOf = mostRecentUpdateTimestamp(
      newUpdates,
      request.updatesCurrentAsOf,
    );
    if (newUpdates.length > 0) {
      timestampUpdatePromises.push(
        recordDeliveredUpdate(viewer.cookieID, updatesCurrentAsOf),
      );
    }
    updatesResult = {
      newUpdates,
      currentAsOf: updatesCurrentAsOf,
    };
  }
  await Promise.all(timestampUpdatePromises);

  const userInfos: any = Object.values({
    ...messagesResult.userInfos,
    ...entriesResult.userInfos,
    ...threadsResult.userInfos,
  });

  const messagesCurrentAsOf = mostRecentMessageTimestamp(
    messagesResult.rawMessageInfos,
    clientMessagesCurrentAsOf,
  );
  const response: PingResponse = {
    threadInfos: threadsResult.threadInfos,
    currentUserInfo,
    rawMessageInfos: messagesResult.rawMessageInfos,
    truncationStatuses: messagesResult.truncationStatuses,
    messagesCurrentAsOf,
    serverTime: messagesCurrentAsOf,
    rawEntryInfos: entriesResult.rawEntryInfos,
    userInfos,
  };
  if (updatesResult) {
    response.updatesResult = updatesResult;
  }

  const serverRequests = [];
  if (viewerMissingPlatform) {
    serverRequests.push({ type: serverRequestTypes.PLATFORM });
  }
  if (viewerMissingDeviceToken) {
    serverRequests.push({ type: serverRequestTypes.DEVICE_TOKEN });
  }
  if (serverRequests.length > 0) {
    response.serverRequests = serverRequests;
  }

  return response;
}

export {
  pingResponder,
};
