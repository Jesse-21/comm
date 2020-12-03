// @flow

import PropTypes from 'prop-types';
import * as React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import FastImage from 'react-native-fast-image';

import {
  type ConnectionStatus,
  connectionStatusPropType,
} from 'lib/types/socket-types';
import { connect } from 'lib/utils/redux-utils';

import type { AppState } from '../redux/redux-setup';
import type { ImageStyle } from '../types/styles';

type Props = {|
  uri: string,
  onLoad: (uri: string) => void,
  spinnerColor: string,
  style: ImageStyle,
  invisibleLoad: boolean,
  // Redux state
  connectionStatus: ConnectionStatus,
|};
type State = {|
  attempt: number,
  loaded: boolean,
|};
class RemoteImage extends React.PureComponent<Props, State> {
  static propTypes = {
    uri: PropTypes.string.isRequired,
    onLoad: PropTypes.func.isRequired,
    spinnerColor: PropTypes.string.isRequired,
    invisibleLoad: PropTypes.bool.isRequired,
    connectionStatus: connectionStatusPropType.isRequired,
  };
  state: State = {
    attempt: 0,
    loaded: false,
  };

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (
      !this.state.loaded &&
      this.props.connectionStatus === 'connected' &&
      prevProps.connectionStatus !== 'connected'
    ) {
      this.setState((otherPrevState) => ({
        attempt: otherPrevState.attempt + 1,
      }));
    }
    if (this.state.loaded && !prevState.loaded) {
      this.props.onLoad && this.props.onLoad(this.props.uri);
    }
  }

  render() {
    const source = { uri: this.props.uri };
    if (this.state.loaded) {
      return (
        <FastImage
          source={source}
          onLoad={this.onLoad}
          style={this.props.style}
          key={this.state.attempt}
        />
      );
    }

    if (this.props.invisibleLoad) {
      return (
        <FastImage
          source={source}
          onLoad={this.onLoad}
          style={[this.props.style, styles.invisible]}
          key={this.state.attempt}
        />
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.spinnerContainer}>
          <ActivityIndicator color={this.props.spinnerColor} size="large" />
        </View>
        <FastImage
          source={source}
          onLoad={this.onLoad}
          style={this.props.style}
          key={this.state.attempt}
        />
      </View>
    );
  }

  onLoad = () => {
    this.setState({ loaded: true });
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  invisible: {
    opacity: 0,
  },
  spinnerContainer: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});

export default connect((state: AppState) => ({
  connectionStatus: state.connection.status,
}))(RemoteImage);
