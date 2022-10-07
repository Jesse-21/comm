{ mkShell
, stdenv
, lib
, amqp-cpp
, arcanist
, aws-sdk-cpp
, better-prompt
, boost
, c-ares_cmake-config
, cargo
, cmake
, cmake-format
, cocoapods
, corrosion
, cryptopp
, darwin
, double-conversion
, folly
, fmt
, glog
, grpc
, gtest
, libiconv
, libuv
, mariadb
, mariadb-up
, nodejs-16_x
, olm
, openjdk8
, openssl
, pkg-config
, protobuf_3_15_cmake
, python3
, redis
, redis-up
, rustc
, shellcheck
, sqlite
, terraform
, watchman
, rustfmt
, yarn
}:

mkShell {

  # programs which are meant to be executed should go here
  nativeBuildInputs = [
    # generic development or tools
    arcanist
    shellcheck
    terraform

    # node development
    mariadb
    nodejs-16_x
    yarn
    watchman # react native
    python3
    redis

    # native dependencies
    # C/CXX toolchains are already brought in with mkShell
    # Identity Service
    cargo # includes rustc
    rustc # allow for direct invocation of rustc
    rustfmt

    # Tunnelbroker + CMake
    amqp-cpp
    c-ares_cmake-config
    cryptopp
    cmake
    cmake-format # linting
    libuv
    pkg-config
    protobuf_3_15_cmake
    grpc
  ] ++ lib.optionals stdenv.isDarwin [
    cocoapods # needed for ios
  ];

  # include any libraries buildInputs
  buildInputs = [
    # protobuf exposes both a library and a command
    # thus should appear in both inputs
    protobuf_3_15_cmake
    aws-sdk-cpp # tunnelbroker
    corrosion # tunnelbroker
    double-conversion # tunnelbroker
    glog # tunnelbroker
    gtest # testing services
    folly # cpp tools
    fmt # needed for folly
    boost # needed for folly
    olm # needed for CryptoTools
    sqlite # needed for sqlite_orm
    openssl # needed for grpc
  ] ++ lib.optionals stdenv.isDarwin (with darwin.apple_sdk.frameworks; [
    CoreFoundation
    CoreServices
    Security
    libiconv  # identity service
  ]);

  JAVA_HOME = openjdk8.passthru.home;

  # shell commands to be ran upon entering shell
  shellHook = ''
    PRJ_ROOT=$(git rev-parse --show-toplevel)

    # Set development environment variable defaults
    source "${../scripts/source_development_defaults.sh}"

    # Cache development path for some use cases such as XCode
    "$PRJ_ROOT/scripts/save_path.sh"

  ''
  # Darwin condition can be removed once linux services are supported
  + lib.optionalString stdenv.isDarwin ''
    # Start MariaDB development services
    "${mariadb-up}"/bin/mariadb-up &
    mariadb_pid=$!

    "${redis-up}"/bin/redis-up &
    redis_pid=$!

    wait "$mariadb_pid" "$redis_pid"
  '' + ''

    # Provide decent bash prompt
    source "${better-prompt}/bin/better-prompt"

    echo "Welcome to Comm dev environment! :)"
  '';
}
