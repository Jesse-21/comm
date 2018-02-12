// @flow

import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

import errorHandler from './error_handler';
import { messageCreationResponder } from './responders/message-responders';
import { updateActivityResponder } from './responders/activity-responders';
import { deviceTokenUpdateResponder } from './responders/device-responders';
import { userSubscriptionUpdateResponder } from './responders/user-responders';

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.post(
  '/create_messages',
  errorHandler(messageCreationResponder),
);
app.post(
  '/update_activity',
  errorHandler(updateActivityResponder),
);
app.post(
  '/update_user_subscription',
  errorHandler(userSubscriptionUpdateResponder),
);
app.post(
  '/update_device_token',
  errorHandler(deviceTokenUpdateResponder),
);
app.listen(parseInt(process.env.PORT) || 3000, 'localhost');
