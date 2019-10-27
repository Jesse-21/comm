// @flow

import type { AppState } from '../redux/redux-setup';
import type { Styles } from '../types/styles';
import type { Colors } from '../themes/colors';

import * as React from 'react';
import { ActivityIndicator } from 'react-native';

import { connect } from 'lib/utils/redux-utils';

import { colorsSelector, styleSelector } from '../themes/colors';

type Props = {|
  // Redux state
  colors: Colors,
  styles: Styles,
|};
function ListLoadingIndicator(props: Props) {
  const { listBackgroundLabel } = props.colors;
  return (
    <ActivityIndicator
      color={listBackgroundLabel}
      size="large"
      style={props.styles.loadingIndicator}
    />
  );
}

const styles = {
  loadingIndicator: {
    flex: 1,
    backgroundColor: 'listBackground',
    padding: 10,
  },
};
const stylesSelector = styleSelector(styles);

export default connect((state: AppState) => ({
  colors: colorsSelector(state),
  styles: stylesSelector(state),
}))(ListLoadingIndicator);
