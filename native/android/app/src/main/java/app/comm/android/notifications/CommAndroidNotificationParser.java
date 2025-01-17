package app.comm.android.notifications;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Set;

public class CommAndroidNotificationParser {

  private static final Set<String> OBLIGATORY_KEYS = Set.of(
      CommNotificationsHandler.TITLE_KEY,
      CommNotificationsHandler.BODY_KEY,
      CommNotificationsHandler.THREAD_ID_KEY);

  private static final Set<String> OPTIONAL_KEYS = Set.of(
      CommNotificationsHandler.MESSAGE_INFOS_KEY,
      CommNotificationsHandler.PREFIX_KEY);

  public static WritableMap
  parseRemoteMessageToJSForegroundMessage(RemoteMessage message) {
    if (message.getData() == null) {
      return null;
    }
    WritableMap jsForegroundMessage = Arguments.createMap();

    for (String key : OBLIGATORY_KEYS) {
      String value = message.getData().get(key);
      if (value == null) {
        return null;
      }
      jsForegroundMessage.putString(key, value);
    }

    for (String key : OPTIONAL_KEYS) {
      String value = message.getData().get(key);
      if (value == null) {
        continue;
      }
      jsForegroundMessage.putString(key, value);
    }

    return jsForegroundMessage;
  }
}
