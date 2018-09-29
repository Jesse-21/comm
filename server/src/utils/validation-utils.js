// @flow

import type { Viewer } from '../session/viewer';

import t from 'tcomb';

import { ServerError } from 'lib/utils/errors';

import { verifyClientSupported } from '../session/version';

async function validateInput(viewer: Viewer, inputValidator: *, input: *) {
  let platformDetails;
  if (inputValidator) {
    platformDetails = findFirstInputMatchingValidator(
      inputValidator,
      tPlatformDetails,
      input,
    );
  }
  if (!platformDetails && inputValidator) {
    const platform = findFirstInputMatchingValidator(
      inputValidator,
      tPlatform,
      input,
    );
    if (platform) {
      platformDetails = { platform };
    }
  }
  if (!platformDetails) {
    ({ platformDetails } = viewer);
  }
  await verifyClientSupported(viewer, platformDetails);

  if (!inputValidator || inputValidator.is(input)) {
    return;
  }

  const sanitizedInput = input ? sanitizeInput(inputValidator, input) : null;
  throw new ServerError('invalid_parameters', { input: sanitizedInput });
}

const fakePassword = "********";
function sanitizeInput(inputValidator: *, input: *) {
  if (!inputValidator) {
    return input;
  }
  if (inputValidator === tPassword && typeof input === "string") {
    return fakePassword;
  }
  if (
    inputValidator.meta.kind === "maybe" &&
    inputValidator.meta.type === tPassword &&
    typeof input === "string"
  ) {
    return fakePassword;
  }
  if (
    inputValidator.meta.kind !== "interface" ||
    typeof input !== "object" ||
    !input
  ) {
    return input;
  }
  const result = {};
  for (let key in input) {
    const value = input[key];
    const validator = inputValidator.meta.props[key];
    result[key] = sanitizeInput(validator, value);
  }
  return result;
}

function findFirstInputMatchingValidator(
  wholeInputValidator: *,
  inputValidatorToMatch: *,
  input: *,
): any {
  if (!wholeInputValidator || input === null || input === undefined) {
    return null;
  }
  if (
    wholeInputValidator === inputValidatorToMatch &&
    wholeInputValidator.is(input)
  ) {
    return input;
  }
  if (wholeInputValidator.meta.kind === "maybe") {
    return findFirstInputMatchingValidator(
      wholeInputValidator.meta.type,
      inputValidatorToMatch,
      input,
    );
  }
  if (
    wholeInputValidator.meta.kind === "interface" &&
    typeof input === "object"
  ) {
    for (let key in input) {
      const value = input[key];
      const validator = wholeInputValidator.meta.props[key];
      const innerResult = findFirstInputMatchingValidator(
        validator,
        inputValidatorToMatch,
        value,
      );
      if (innerResult) {
        return innerResult;
      }
    }
  }
  if (wholeInputValidator.meta.kind === "union") {
    for (let validator of wholeInputValidator.meta.types) {
      if (validator.is(input)) {
        return findFirstInputMatchingValidator(
          validator,
          inputValidatorToMatch,
          input,
        );
      }
    }
  }
  if (
    wholeInputValidator.meta.kind === "list" &&
    Array.isArray(input)
  ) {
    const validator = wholeInputValidator.meta.type;
    for (let value of input) {
      const innerResult = findFirstInputMatchingValidator(
        validator,
        inputValidatorToMatch,
        value,
      );
      if (innerResult) {
        return innerResult;
      }
    }
  }
  return null;
}

function tBool(value: bool) {
  return t.irreducible('literal bool', x => x === value);
}

function tString(value: string) {
  return t.irreducible('literal string', x => x === value);
}

function tShape(spec: {[key: string]: *}) {
  return t.interface(spec, { strict: true });
}

function tRegex(regex: RegExp) {
  return t.refinement(t.String, val => regex.test(val));
}

function tNumEnum(assertFunc: (input: number) => *) {
  return t.refinement(
    t.Number,
    (input: number) => {
      try {
        assertFunc(input);
        return true;
      } catch (e) {
        return false;
      }
    },
  );
}

const tDate = tRegex(/^[0-9]{4}-[0-1][0-9]-[0-3][0-9]$/);
const tColor = tRegex(/^[a-fA-F0-9]{6}$/); // we don't include # char
const tPlatform = t.enums.of(['ios', 'android', 'web']);
const tDeviceType = t.enums.of(['ios', 'android']);
const tPlatformDetails = tShape({
  platform: tPlatform,
  codeVersion: t.maybe(t.Number),
  stateVersion: t.maybe(t.Number),
});
const tPassword = t.refinement(t.String, (password: string) => password);

export {
  validateInput,
  tBool,
  tString,
  tShape,
  tRegex,
  tNumEnum,
  tDate,
  tColor,
  tPlatform,
  tDeviceType,
  tPlatformDetails,
  tPassword,
};
