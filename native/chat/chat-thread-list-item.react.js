// @flow

import {
  type ChatThreadItem,
  chatThreadItemPropType,
} from 'lib/selectors/chat-selectors';
import type { ThreadInfo } from 'lib/types/thread-types';
import type { AppState } from '../redux/redux-setup';
import { type Colors, colorsPropType } from '../themes/colors';
import type { Styles } from '../types/styles';

import * as React from 'react';
import { View, Text } from 'react-native';
import PropTypes from 'prop-types';

import { shortAbsoluteDate } from 'lib/utils/date-utils';
import { connect } from 'lib/utils/redux-utils';

import Button from '../components/button.react';
import MessagePreview from './message-preview.react';
import ColorSplotch from '../components/color-splotch.react';
import { colorsSelector, styleSelector } from '../themes/colors';

type Props = {
  data: ChatThreadItem,
  onPressItem: (threadInfo: ThreadInfo) => void,
  // Redux state
  colors: Colors,
  styles: Styles,
};
class ChatThreadListItem extends React.PureComponent<Props> {

  static propTypes = {
    data: chatThreadItemPropType.isRequired,
    onPressItem: PropTypes.func.isRequired,
    colors: colorsPropType.isRequired,
    styles: PropTypes.objectOf(PropTypes.object).isRequired,
  };

  lastMessage() {
    const mostRecentMessageInfo = this.props.data.mostRecentMessageInfo;
    if (!mostRecentMessageInfo) {
      return (
        <Text style={this.props.styles.noMessages} numberOfLines={1}>
          No messages
        </Text>
      );
    }
    return (
      <MessagePreview
        messageInfo={mostRecentMessageInfo}
        threadInfo={this.props.data.threadInfo}
      />
    );
  }

  render() {
    const lastActivity = shortAbsoluteDate(this.props.data.lastUpdatedTime);
    const unreadStyle = this.props.data.threadInfo.currentUser.unread
      ? this.props.styles.unread
      : null;
    const { listIosHighlightUnderlay } = this.props.colors;
    return (
      <Button
        onPress={this.onPress}
        iosFormat="highlight"
        iosHighlightUnderlayColor={listIosHighlightUnderlay}
        iosActiveOpacity={0.85}
      >
        <View style={this.props.styles.container}>
          <View style={this.props.styles.row}>
            <Text style={[
              this.props.styles.threadName,
              unreadStyle,
            ]} numberOfLines={1}>
              {this.props.data.threadInfo.uiName}
            </Text>
            <View style={this.props.styles.colorSplotch}>
              <ColorSplotch
                color={this.props.data.threadInfo.color}
                size="small"
              />
            </View>
          </View>
          <View style={this.props.styles.row}>
            {this.lastMessage()}
            <Text style={[ this.props.styles.lastActivity, unreadStyle ]}>
              {lastActivity}
            </Text>
          </View>
        </View>
      </Button>
    );
  }

  onPress = () => {
    this.props.onPressItem(this.props.data.threadInfo);
  }

}

const styles = {
  container: {
    height: 60,
    paddingLeft: 10,
    paddingTop: 5,
    paddingRight: 10,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  threadName: {
    flex: 1,
    paddingLeft: 10,
    fontSize: 20,
    color: 'listForegroundSecondaryLabel',
  },
  colorSplotch: {
    marginTop: 2,
    marginLeft: 10,
  },
  noMessages: {
    flex: 1,
    paddingLeft: 10,
    fontStyle: 'italic',
    fontSize: 16,
    color: 'listForegroundTertiaryLabel',
  },
  lastActivity: {
    fontSize: 16,
    color: 'listForegroundTertiaryLabel',
    marginLeft: 10,
  },
  unread: {
    color: 'listForegroundLabel',
    fontWeight: 'bold',
  },
};
const stylesSelector = styleSelector(styles);

export default connect((state: AppState) => ({
  colors: colorsSelector(state),
  styles: stylesSelector(state),
}))(ChatThreadListItem);
