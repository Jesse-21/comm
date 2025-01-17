FROM rust:1.67

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
  protobuf-compiler && rm -rf /var/lib/apt/lists/*

# Create a new user comm and use it to run subsequent commands
RUN useradd -m comm
USER comm

# The build.rs script depends on rustfmt
RUN rustup component add rustfmt

RUN mkdir -p /home/comm/app/identity
WORKDIR /home/comm/app/identity
RUN cargo init --bin

COPY services/identity/Cargo.toml services/identity/Cargo.lock ./
COPY shared/comm-opaque ../../shared/comm-opaque

# Cache build dependencies in a new layer
RUN cargo build --release
RUN rm src/*.rs

COPY services/identity .
COPY shared/protos/identity.proto ../../shared/protos/

# Remove the previously-built binary so that only the application itself is
# rebuilt
RUN rm ./target/release/deps/identity*

RUN cargo build --release
RUN target/release/identity keygen

CMD ["./target/release/identity", "server"]
