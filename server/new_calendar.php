<?php

require_once('async_lib.php');
require_once('config.php');
require_once('auth.php');
require_once('calendar_lib.php');

async_start();

if (
  !isset($_POST['name']) ||
  !isset($_POST['description']) ||
  !isset($_POST['visibility_rules']) ||
  !isset($_POST['color'])
) {
  async_end(array(
    'error' => 'invalid_parameters',
  ));
}

$color = strtolower($_POST['color']);
if (!preg_match('/^[a-f0-9]{6}$/', $color)) {
  async_end(array(
    'error' => 'invalid_parameters',
  ));
}

if (!user_logged_in()) {
  async_end(array(
    'error' => 'not_logged_in',
  ));
}

$visibility_rules = intval($_POST['visibility_rules']);
$password = null;
if ($visibility_rules >= VISIBILITY_CLOSED) {
  if (!isset($_POST['password'])) {
    async_end(array(
      'error' => 'invalid_parameters',
    ));
  }
  $password = $_POST['password'];
}

$name = $conn->real_escape_string($_POST['name']);
$description = $conn->real_escape_string($_POST['description']);
$time = round(microtime(true) * 1000); // in milliseconds
$conn->query("INSERT INTO ids(table_name) VALUES('calendars')");
$id = $conn->insert_id;
$creator = get_viewer_id();
$edit_rules = $visibility_rules >= VISIBILITY_CLOSED
  ? EDIT_LOGGED_IN
  : EDIT_ANYBODY;
if ($visibility_rules >= VISIBILITY_CLOSED) {
  $hash = password_hash($password, PASSWORD_BCRYPT);
  $conn->query(
    "INSERT INTO calendars".
      "(id, name, description, visibility_rules, hash, edit_rules, ".
      "creator, creation_time, color) ".
      "VALUES ($id, '$name', '$description', $visibility_rules, '$hash', ".
      "$edit_rules, $creator, $time, '$color')"
  );
} else {
  $conn->query(
    "INSERT INTO calendars".
      "(id, name, description, visibility_rules, hash, edit_rules, ".
      "creator, creation_time, color) ".
      "VALUES ($id, '$name', '$description', $visibility_rules, NULL, ".
      "$edit_rules, $creator, $time, '$color')"
  );
}

$conn->query(
  "INSERT INTO roles(calendar, user, creation_time, last_view, role, ".
    "subscribed) ".
    "VALUES ($id, $creator, $time, $time, ".ROLE_CREATOR.", 1)"
);

async_end(array(
  'success' => true,
  'new_calendar_id' => $id,
));
