# File: Builds the Rust CLI and static trace visualizer into a minimal non-root runtime image.
FROM rust:1.99.1-bookworm AS rust-build
WORKDIR /source
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --locked --release

FROM node:24.22.0-bookworm-slim AS web-build
WORKDIR /source/web
COPY web/package.json web/package-lock.json web/tsconfig.json ./
RUN npm ci
COPY web/src ./src
COPY web/tests ./tests
COPY web/public ./public
COPY web/scripts ./scripts
RUN npm test && npm run smoke

FROM debian:bookworm-slim AS runtime
RUN groupadd --system workbench && useradd --system --gid workbench --create-home workbench
COPY --from=rust-build /source/target/release/mips-workbench /usr/local/bin/mips-workbench
COPY --from=web-build /source/web/dist /opt/mips-workbench/web
USER workbench
WORKDIR /home/workbench
ENTRYPOINT ["mips-workbench"]
CMD ["help"]
