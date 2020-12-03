// @flow

import invariant from 'invariant';
import PropTypes from 'prop-types';
import * as React from 'react';

import {
  type ChatMessageInfoItem,
  chatMessageItemPropType,
} from 'lib/selectors/chat-selectors';
import { messageID } from 'lib/shared/message-utils';
import {
  messageTypes,
  type RawComposableMessageInfo,
  assertComposableMessageType,
} from 'lib/types/message-types';
import { type ThreadInfo, threadInfoPropType } from 'lib/types/thread-types';

import {
  inputStatePropType,
  type InputState,
  InputStateContext,
} from '../input/input-state';
import { useSelector } from '../redux/redux-utils';
import css from './chat-message-list.css';
import multimediaMessageSendFailed from './multimedia-message-send-failed';
import textMessageSendFailed from './text-message-send-failed';

type BaseProps = {|
  +item: ChatMessageInfoItem,
  +threadInfo: ThreadInfo,
|};
type Props = {|
  ...BaseProps,
  // Redux state
  +rawMessageInfo: RawComposableMessageInfo,
  // withInputState
  +inputState: ?InputState,
|};
class FailedSend extends React.PureComponent<Props> {
  static propTypes = {
    item: chatMessageItemPropType.isRequired,
    threadInfo: threadInfoPropType.isRequired,
    rawMessageInfo: PropTypes.object.isRequired,
    inputState: inputStatePropType,
  };
  retryingText = false;
  retryingMedia = false;

  componentDidUpdate(prevProps: Props) {
    if (
      (this.props.rawMessageInfo.type === messageTypes.IMAGES ||
        this.props.rawMessageInfo.type === messageTypes.MULTIMEDIA) &&
      (prevProps.rawMessageInfo.type === messageTypes.IMAGES ||
        prevProps.rawMessageInfo.type === messageTypes.MULTIMEDIA)
    ) {
      const { inputState } = this.props;
      const prevInputState = prevProps.inputState;
      invariant(
        inputState && prevInputState,
        'inputState should be set in FailedSend',
      );
      const isFailed = multimediaMessageSendFailed(this.props.item, inputState);
      const wasFailed = multimediaMessageSendFailed(
        prevProps.item,
        prevInputState,
      );
      const isDone =
        this.props.item.messageInfo.id !== null &&
        this.props.item.messageInfo.id !== undefined;
      const wasDone =
        prevProps.item.messageInfo.id !== null &&
        prevProps.item.messageInfo.id !== undefined;
      if ((isFailed && !wasFailed) || (isDone && !wasDone)) {
        this.retryingMedia = false;
      }
    } else if (
      this.props.rawMessageInfo.type === messageTypes.TEXT &&
      prevProps.rawMessageInfo.type === messageTypes.TEXT
    ) {
      const isFailed = textMessageSendFailed(this.props.item);
      const wasFailed = textMessageSendFailed(prevProps.item);
      const isDone =
        this.props.item.messageInfo.id !== null &&
        this.props.item.messageInfo.id !== undefined;
      const wasDone =
        prevProps.item.messageInfo.id !== null &&
        prevProps.item.messageInfo.id !== undefined;
      if ((isFailed && !wasFailed) || (isDone && !wasDone)) {
        this.retryingText = false;
      }
    }
  }

  render() {
    return (
      <div className={css.failedSend}>
        <span>Delivery failed.</span>
        <a onClick={this.retrySend} className={css.retrySend}>
          {'Retry?'}
        </a>
      </div>
    );
  }

  retrySend = (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.stopPropagation();

    const { inputState } = this.props;
    invariant(inputState, 'inputState should be set in FailedSend');

    const { rawMessageInfo } = this.props;
    if (rawMessageInfo.type === messageTypes.TEXT) {
      if (this.retryingText) {
        return;
      }
      this.retryingText = true;
      inputState.sendTextMessage({
        ...rawMessageInfo,
        time: Date.now(),
      });
    } else if (
      rawMessageInfo.type === messageTypes.IMAGES ||
      rawMessageInfo.type === messageTypes.MULTIMEDIA
    ) {
      const { localID } = rawMessageInfo;
      invariant(localID, 'failed RawMessageInfo should have localID');
      if (this.retryingMedia) {
        return;
      }
      this.retryingMedia = true;
      inputState.retryMultimediaMessage(localID);
    }
  };
}

export default React.memo<BaseProps>(function ConnectedFailedSend(
  props: BaseProps,
) {
  const { messageInfo } = props.item;
  assertComposableMessageType(messageInfo.type);
  const id = messageID(messageInfo);
  const rawMessageInfo = useSelector(
    (state) => state.messageStore.messages[id],
  );
  assertComposableMessageType(rawMessageInfo.type);
  invariant(
    rawMessageInfo.type === messageTypes.TEXT ||
      rawMessageInfo.type === messageTypes.IMAGES ||
      rawMessageInfo.type === messageTypes.MULTIMEDIA,
    'FailedSend should only be used for composable message types',
  );
  const inputState = React.useContext(InputStateContext);
  return (
    <FailedSend
      {...props}
      rawMessageInfo={rawMessageInfo}
      inputState={inputState}
    />
  );
});
