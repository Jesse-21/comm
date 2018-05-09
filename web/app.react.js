// @flow

import type { LoadingStatus } from 'lib/types/loading-types';
import { type AppState, type NavInfo, navInfoPropType } from './redux-setup';
import type {
  DispatchActionPayload,
  DispatchActionPromise,
} from 'lib/utils/action-utils';
import { type VerifyField, verifyField } from 'lib/types/verify-types';
import type { CalendarQuery, CalendarResult } from 'lib/types/entry-types';
import {
  type PingStartingPayload,
  type PingActionInput,
  type PingResult,
  type PingTimestamps,
  pingTimestampsPropType,
} from 'lib/types/ping-types';

import * as React from 'react';
import invariant from 'invariant';
import _isEqual from 'lodash/fp/isEqual';
import PropTypes from 'prop-types';
import Visibility from 'visibilityjs';
import FontAwesomeIcon from '@fortawesome/react-fontawesome';
import faCalendar from '@fortawesome/fontawesome-free-solid/faCalendar';
import faChat from '@fortawesome/fontawesome-free-solid/faComments';
import classNames from 'classnames';
import fontawesome from '@fortawesome/fontawesome';

import { getDate } from 'lib/utils/date-utils';
import {
  nullState,
  currentCalendarQuery,
} from 'lib/selectors/nav-selectors';
import {
  fetchEntriesActionTypes,
  fetchEntries,
} from 'lib/actions/entry-actions';
import { createLoadingStatusSelector } from 'lib/selectors/loading-selectors';
import { connect } from 'lib/utils/redux-utils';
import {
  pingStartingPayload,
  pingActionInput,
} from 'lib/selectors/ping-selectors';
import { pingActionTypes, ping } from 'lib/actions/ping-actions';
import { pingFrequency, dispatchPing } from 'lib/shared/ping-utils';
import {
  sessionInactivityLimit,
  sessionTimeLeft,
  nextSessionID,
} from 'lib/selectors/session-selectors';
import { newSessionIDActionType } from 'lib/reducers/session-reducer';
import {
  filteredThreadIDsSelector,
} from 'lib/selectors/calendar-filter-selectors';
import { registerConfig } from 'lib/utils/config';

import { canonicalURLFromReduxState, navInfoFromURL } from './url-utils';
import css from './style.css';
import AccountBar from './account-bar.react';
import Calendar from './calendar/calendar.react';
import ResetPasswordModal from './modals/account/reset-password-modal.react';
import VerificationSuccessModal
  from './modals/account/verification-success-modal.react';
import LoadingIndicator from './loading-indicator.react';
import history from './router-history';
import IntroModal from './modals/intro-modal.react';
import { reflectRouteChangeActionType } from './redux-setup';
import Splash from './splash/splash.react';
import Chat from './chat/chat.react';

// We want Webpack's css-loader and style-loader to handle the Fontawesome CSS,
// so we disable the autoAddCss logic and import the CSS file.
fontawesome.config = { autoAddCss: false };
import '@fortawesome/fontawesome/styles.css';

registerConfig({
  // We can't securely cache credentials on web, so we have no way to recover
  // from a cookie invalidation
  resolveInvalidatedCookie: null,
  // We use httponly cookies on web to protect against XSS attacks, so we have
  // no access to the cookies from JavaScript
  getNewCookie: null,
  setCookieOnRequest: false,
  // Never reset the calendar range
  calendarRangeInactivityLimit: null,
  platform: "web",
});

type Props = {
  location: {
    pathname: string,
  },
  // Redux state
  navInfo: NavInfo,
  verifyField: ?VerifyField,
  entriesLoadingStatus: LoadingStatus,
  nullState: bool,
  currentCalendarQuery: () => CalendarQuery,
  pingStartingPayload: () => PingStartingPayload,
  pingActionInput: (startingPayload: PingStartingPayload) => PingActionInput,
  pingTimestamps: PingTimestamps,
  sessionTimeLeft: () => number,
  nextSessionID: () => ?string,
  loggedIn: bool,
  activeThreadFilter: bool,
  cookie: ?string,
  // Redux dispatch functions
  dispatchActionPayload: DispatchActionPayload,
  dispatchActionPromise: DispatchActionPromise,
  // async functions that hit server APIs
  fetchEntries: (
    calendarQuery: CalendarQuery,
  ) => Promise<CalendarResult>,
  ping: (actionInput: PingActionInput) => Promise<PingResult>,
};
type State = {
  // In null state cases, currentModal can be set to something, but modalExists
  // will be false. This is because we need to know if a modal is overlaid over
  // the null state
  modalExists: bool,
  currentModal: ?React.Node,
};

class App extends React.PureComponent<Props, State> {

  pingCounter = 0;

  constructor(props: Props) {
    super(props);
    let currentModal = null;
    if (props.nullState) {
      if (!props.activeThreadFilter) {
        currentModal = <IntroModal />;
      } else {
        currentModal = <div className={css['modal-overlay']} />;
      }
    }
    this.state = {
      modalExists: false,
      currentModal: currentModal,
    };
  }

  componentDidMount() {
    if (this.props.navInfo.verify) {
      if (this.props.verifyField === verifyField.RESET_PASSWORD) {
        this.showResetPasswordModal();
      } else if (this.props.verifyField === verifyField.EMAIL) {
        const newURL = canonicalURLFromReduxState(
          {
            startDate: this.props.navInfo.startDate,
            endDate: this.props.navInfo.endDate,
            tab: this.props.navInfo.tab,
            verify: null,
          },
          this.props.location.pathname,
        );
        history.replace(newURL);
        this.setModal(
          <VerificationSuccessModal onClose={this.clearModal} />
        );
      }
    }

    if (this.props.loggedIn) {
      const newURL = canonicalURLFromReduxState(
        this.props.navInfo,
        this.props.location.pathname,
      );
      if (this.props.location.pathname !== newURL) {
        history.replace(newURL);
      }
      this.startTimeouts(this.props);
    }

    Visibility.change(this.onVisibilityChange);
  }

  onVisibilityChange = (e, state: string) => {
    if (state === "visible") {
      this.startTimeouts(this.props);
    }
  }

  shouldDispatchPing(props: Props) {
    if (Visibility.hidden() || !props.loggedIn) {
      return false;
    }
    const lastPingStart = props.pingTimestamps.lastStarted;
    const timeUntilNextPing = lastPingStart + pingFrequency - Date.now();
    if (this.pingCounter === 0 && timeUntilNextPing < 500) {
      return true;
    } else if (lastPingStart < Date.now() - pingFrequency * 10) {
      // It seems we have encountered some error start where ping isn't firing
      this.pingCounter = 0;
      return true;
    }
    return false;
  }

  possiblePing = (inputProps?: Props) => {
    const props = inputProps ? inputProps : this.props;
    if (this.shouldDispatchPing(props)) {
      this.pingNow(inputProps);
    }
  }

  pingNow(inputProps?: Props) {
    const props = inputProps ? inputProps : this.props;
    // This will only trigger if the ping is complete by then. If the ping isn't
    // complete by the time this timeout fires, componentWillReceiveProps takes
    // responsibility for starting the next ping.
    setTimeout(this.possiblePing, pingFrequency);
    // This one runs in case something is wrong with pingCounter state or timing
    // and the first one gets swallowed without triggering another ping.
    setTimeout(this.possiblePing, pingFrequency * 10);
    dispatchPing(props);
  }

  possiblyNewSessionID = (inputProps?: Props) => {
    const props = inputProps ? inputProps : this.props;
    if (!Visibility.hidden() || props.loggedIn) {
      return;
    }
    const sessionID = props.nextSessionID();
    if (sessionID) {
      props.dispatchActionPayload(newSessionIDActionType, sessionID);
      setTimeout(
        this.possiblyNewSessionID,
        sessionInactivityLimit,
      );
    } else {
      const timeLeft = props.sessionTimeLeft();
      setTimeout(
        this.possiblyNewSessionID,
        timeLeft + 10,
      );
    }
  }

  startTimeouts(inputProps?: Props) {
    const props = inputProps ? inputProps : this.props;
    if (props.loggedIn) {
      this.possiblePing(props);
    } else {
      this.possiblyNewSessionID(props);
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.verifyField === verifyField.RESET_PASSWORD) {
      if (prevProps.navInfo.verify && !this.props.navInfo.verify) {
        this.clearModal();
      } else if (!prevProps.navInfo.verify && this.props.navInfo.verify) {
        this.showResetPasswordModal();
      }
    }
  }

  showResetPasswordModal() {
    const newURL = canonicalURLFromReduxState(
      {
        startDate: this.props.navInfo.startDate,
        endDate: this.props.navInfo.endDate,
        tab: this.props.navInfo.tab,
        verify: null,
      },
      this.props.location.pathname,
    );
    const onClose = () => history.push(newURL);
    const onSuccess = () => history.replace(newURL);
    this.setModal(
      <ResetPasswordModal onClose={onClose} onSuccess={onSuccess} />
    );
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.location.pathname !== this.props.location.pathname) {
      const newNavInfo = navInfoFromURL(
        nextProps.location.pathname,
        nextProps.navInfo,
      );
      if (!_isEqual(newNavInfo)(nextProps.navInfo)) {
        this.props.dispatchActionPayload(
          reflectRouteChangeActionType,
          newNavInfo,
        );
      }
    } else if (!_isEqual(nextProps.navInfo)(this.props.navInfo)) {
      const newURL = canonicalURLFromReduxState(
        nextProps.navInfo,
        nextProps.location.pathname,
      );
      if (newURL !== nextProps.location.pathname) {
        history.replace(newURL);
      }
    }

    if (!this.state.modalExists) {
      let newModal = undefined;
      if (
        (!nextProps.activeThreadFilter && nextProps.nullState) &&
        (this.props.activeThreadFilter || !this.props.nullState)
      ) {
        newModal = <IntroModal />;
      } else if (
        (nextProps.activeThreadFilter && nextProps.nullState) &&
        (!this.props.activeThreadFilter || !this.props.nullState)
      ) {
        newModal = <div className={css['modal-overlay']} />;
      } else if (!nextProps.nullState && this.props.nullState) {
        newModal = null;
      }
      if (newModal !== undefined) {
        this.setState({ currentModal: newModal });
      }
    }

    if (
      !nextProps.nullState &&
      nextProps.loggedIn &&
      (nextProps.nullState !== this.props.nullState ||
        nextProps.navInfo.startDate !== this.props.navInfo.startDate ||
        nextProps.navInfo.endDate !== this.props.navInfo.endDate)
    ) {
      nextProps.dispatchActionPromise(
        fetchEntriesActionTypes,
        nextProps.fetchEntries(nextProps.currentCalendarQuery()),
      );
    }

    const prevLastPingSuccess = this.props.pingTimestamps.lastSuccess;
    const nextLastPingSuccess = nextProps.pingTimestamps.lastSuccess;
    const prevLastPingStart = this.props.pingTimestamps.lastStarted;
    const nextLastPingStart = nextProps.pingTimestamps.lastStarted;
    const prevLastPingComplete = this.props.pingTimestamps.lastCompletion;
    const nextLastPingComplete = nextProps.pingTimestamps.lastCompletion;
    if (prevLastPingComplete !== nextLastPingComplete) {
      if (this.pingCounter > 0) {
        this.pingCounter--;
      }
      this.possiblePing(nextProps);
    }
    if (prevLastPingStart !== nextLastPingStart) {
      this.pingCounter++;
    }

    if (nextProps.loggedIn && !this.props.loggedIn) {
      const newURL = canonicalURLFromReduxState(
        nextProps.navInfo,
        nextProps.location.pathname,
      );
      if (nextProps.location.pathname !== newURL) {
        history.replace(newURL);
      }
      this.startTimeouts(nextProps);
    }
  }

  render() {
    let content;
    if (this.props.loggedIn) {
      content = this.renderMainContent();
    } else {
      content = (
        <Splash
          setModal={this.setModal}
          clearModal={this.clearModal}
          currentModal={this.state.currentModal}
        />
      );
    }
    return (
      <React.Fragment>
        {content}
        {this.state.currentModal}
      </React.Fragment>
    );
  }

  renderMainContent() {
    const calendarNavClasses = classNames({
      [css['current-tab']]: this.props.navInfo.tab === "calendar",
    });
    const chatNavClasses = classNames({
      [css['current-tab']]: this.props.navInfo.tab === "chat",
    });

    let mainContent;
    if (this.props.navInfo.tab === "calendar") {
      mainContent = (
        <Calendar
          setModal={this.setModal}
          clearModal={this.clearModal}
          url={this.props.location.pathname}
        />
      );
    } else if (this.props.navInfo.tab === "chat") {
      mainContent = (
        <Chat />
      );
    }

    return (
      <React.Fragment>
        <header className={css['header']}>
          <div className={css['main-header']}>
            <h1>SquadCal</h1>
            <ul className={css['nav-bar']}>
              <li className={calendarNavClasses}>
                <div><a onClick={this.onClickCalendar}>
                  <FontAwesomeIcon
                    icon={faCalendar}
                    className={css['nav-bar-icon']}
                  />
                  Calendar
                </a></div>
              </li>
              <li className={chatNavClasses}>
                <div><a onClick={this.onClickChat}>
                  <FontAwesomeIcon
                    icon={faChat}
                    className={css['nav-bar-icon']}
                  />
                  Chat
                </a></div>
              </li>
            </ul>
            <div className={css['upper-right']}>
              <LoadingIndicator
                status={this.props.entriesLoadingStatus}
                size="large"
                loadingClassName={css['page-loading']}
                errorClassName={css['page-error']}
              />
              <AccountBar
                setModal={this.setModal}
                clearModal={this.clearModal}
                modalExists={this.state.modalExists}
              />
            </div>
          </div>
        </header>
        <div className={css['main-content-container']}>
          <div className={css['main-content']}>
            {mainContent}
          </div>
        </div>
      </React.Fragment>
    );
  }

  setModal = (modal: React.Node) => {
    this.setState({
      currentModal: modal,
      modalExists: true,
    });
  }

  clearModal = () => {
    let currentModal = null;
    if (this.props.nullState && !this.props.activeThreadFilter) {
      currentModal = <IntroModal />;
    } else if (this.props.nullState) {
      currentModal = <div className={css['modal-overlay']} />;
    }
    this.setState({
      currentModal,
      modalExists: false,
    });
  }

  onClickCalendar = (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.dispatchActionPayload(
      reflectRouteChangeActionType,
      {
        ...this.props.navInfo,
        tab: "calendar",
      },
    );
  }

  onClickChat = (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.dispatchActionPayload(
      reflectRouteChangeActionType,
      {
        ...this.props.navInfo,
        tab: "chat",
      },
    );
  }

}

App.propTypes = {
  location: PropTypes.shape({
    pathname: PropTypes.string.isRequired,
  }).isRequired,
  navInfo: navInfoPropType.isRequired,
  verifyField: PropTypes.number,
  entriesLoadingStatus: PropTypes.string.isRequired,
  nullState: PropTypes.bool.isRequired,
  currentCalendarQuery: PropTypes.func.isRequired,
  pingStartingPayload: PropTypes.func.isRequired,
  pingActionInput: PropTypes.func.isRequired,
  pingTimestamps: pingTimestampsPropType.isRequired,
  sessionTimeLeft: PropTypes.func.isRequired,
  nextSessionID: PropTypes.func.isRequired,
  loggedIn: PropTypes.bool.isRequired,
  activeThreadFilter: PropTypes.bool.isRequired,
  cookie: PropTypes.string,
  dispatchActionPayload: PropTypes.func.isRequired,
  dispatchActionPromise: PropTypes.func.isRequired,
  fetchEntries: PropTypes.func.isRequired,
  ping: PropTypes.func.isRequired,
};

const loadingStatusSelector
  = createLoadingStatusSelector(fetchEntriesActionTypes);

export default connect(
  (state: AppState) => {
    const loggedIn = !!(state.currentUserInfo &&
        !state.currentUserInfo.anonymous && true);
    return {
      navInfo: state.navInfo,
      verifyField: state.verifyField,
      entriesLoadingStatus: loadingStatusSelector(state),
      nullState: loggedIn && nullState(state),
      currentCalendarQuery: currentCalendarQuery(state),
      pingStartingPayload: pingStartingPayload(state),
      pingActionInput: pingActionInput(state),
      pingTimestamps: state.pingTimestamps,
      sessionTimeLeft: sessionTimeLeft(state),
      nextSessionID: nextSessionID(state),
      loggedIn,
      activeThreadFilter: !!filteredThreadIDsSelector(state),
      cookie: state.cookie,
    };
  },
  { fetchEntries, ping },
)(App);
