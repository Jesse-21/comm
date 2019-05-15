// @flow

import type { Dimensions } from 'lib/types/media-types';

import * as React from 'react';
import PropTypes from 'prop-types';
import {
  Image,
  TouchableOpacity,
  StyleSheet,
  View,
  Text,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

export type GalleryImageInfo = {|
  ...Dimensions,
  uri: string,
|};

type Props = {|
  imageInfo: GalleryImageInfo,
  containerHeight: number,
  queueModeActive: bool,
  isQueued: bool,
  setImageQueued: (image: GalleryImageInfo, isQueued: bool) => void,
  sendImage: (image: GalleryImageInfo) => void,
  isFocused: bool,
  setFocus: (image: GalleryImageInfo) => void,
  screenWidth: number,
|};
class ImageGalleryImage extends React.PureComponent<Props> {

  static propTypes = {
    imageInfo: PropTypes.shape({
      height: PropTypes.number.isRequired,
      width: PropTypes.number.isRequired,
      uri: PropTypes.string.isRequired,
    }).isRequired,
    containerHeight: PropTypes.number.isRequired,
    queueModeActive: PropTypes.bool.isRequired,
    isQueued: PropTypes.bool.isRequired,
    setImageQueued: PropTypes.func.isRequired,
    sendImage: PropTypes.func.isRequired,
    isFocused: PropTypes.bool.isRequired,
    setFocus: PropTypes.func.isRequired,
    screenWidth: PropTypes.number.isRequired,
  };
  backdrop: ?TouchableOpacity;

  static isActive(props: Props) {
    return props.isFocused || props.isQueued;
  }

  componentDidUpdate(prevProps: Props) {
    const { backdrop } = this;
    if (!backdrop) {
      return;
    }
    const isActive = ImageGalleryImage.isActive(this.props);
    const wasActive = ImageGalleryImage.isActive(prevProps);
    if (isActive && !wasActive) {
      backdrop.setOpacityTo(0.2, 0);
    } else if (!isActive && wasActive) {
      backdrop.setOpacityTo(1, 0);
    }
  }

  render() {
    const { imageInfo, containerHeight } = this.props;
    const { uri, width, height } = imageInfo;
    const source = { uri };
    const active = ImageGalleryImage.isActive(this.props);
    const dimensionsStyle = {
      height: containerHeight,
      width: Math.min(
        width / height * containerHeight,
        this.props.screenWidth,
      ),
    };
    const backdropStyle = {
      opacity: active ? 0.2 : 1,
    };

    let buttons = null;
    if (active) {
      const buttonList = [];
      const { queueModeActive } = this.props;
      if (!queueModeActive) {
        buttonList.push(
          <TouchableOpacity
            onPress={this.onPressSend}
            style={styles.sendButton}
            activeOpacity={0.6}
            key="send"
          >
            <Icon name="send" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>
              Send
            </Text>
          </TouchableOpacity>
        );
      }
      const enqueueButtonText = queueModeActive ? "Select" : "Queue";
      buttonList.push(
        <TouchableOpacity
          onPress={this.onPressEnqueue}
          style={styles.enqueueButton}
          activeOpacity={0.6}
          key="queue"
        >
          <MaterialIcon name="add-to-photos" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>
            {enqueueButtonText}
          </Text>
        </TouchableOpacity>
      );
      buttons = (
        <View style={styles.buttons}>
          {buttonList}
        </View>
      );
    }

    return (
      <View style={[ styles.container, dimensionsStyle ]}>
        <TouchableOpacity
          onPress={this.onPressBackdrop}
          style={[ styles.container, backdropStyle ]}
          ref={this.backdropRef}
        >
          <Image source={source} style={dimensionsStyle} />
        </TouchableOpacity>
        {buttons}
      </View>
    );
  }

  backdropRef = (backdrop: ?TouchableOpacity) => {
    this.backdrop = backdrop;
  }

  onPressBackdrop = () => {
    this.props.setFocus(this.props.imageInfo);
  }

  onPressSend = () => {
    this.props.sendImage(this.props.imageInfo);
  }

  onPressEnqueue = () => {
    this.props.setImageQueued(this.props.imageInfo, !this.props.isQueued);
  }

}

const buttonStyle = {
  flexDirection: 'row',
  alignItems: 'flex-start',
  margin: 10,
  borderRadius: 20,
  paddingLeft: 20,
  paddingRight: 20,
  paddingTop: 10,
  paddingBottom: 10,
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  buttons: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    ...buttonStyle,
    backgroundColor: '#0D9314',
    paddingLeft: 18,
  },
  enqueueButton: {
    ...buttonStyle,
    backgroundColor: '#0C3092',
  },
  buttonIcon: {
    alignSelf: Platform.OS === "android" ? 'center' : 'flex-end',
    marginRight: 6,
    color: 'white',
    fontSize: 18,
    paddingRight: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
});

export default ImageGalleryImage;
