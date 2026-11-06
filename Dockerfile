# syntax=docker/dockerfile:1

# Home Screen on Alpine: one static musl binary, no shell tools beyond busybox, no SSH server.
#
#   docker build -t home-screen .                       build everything from source (default)
#   docker build --target binary -o out .               just the Linux binary, written to ./out
#   docker build --target runtime-prebuilt ...          what the release workflow does (see below)

# ---- web interface -----------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:24-alpine AS web
WORKDIR /w
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- server (static musl, OpenSSL compiled in) ---------------------------------------------------
FROM rust:alpine AS build
RUN apk add --no-cache musl-dev linux-headers gcc perl make
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY --from=web /w/dist ./web/dist
RUN cargo build --release --locked

# Just the binary: `docker build --target binary -o out .` (the release workflow uses this)
FROM scratch AS binary
COPY --from=build /src/target/release/home_screen /home_screen

# ---- runtime ---------------------------------------------------------------------------------------
FROM alpine:3.22 AS runtime-base
RUN apk add --no-cache ca-certificates \
 && addgroup -S -g 10001 app \
 && adduser -S -u 10001 -G app -h /data app \
 && mkdir -p /data && chown app:app /data
ENV HOME_SCREEN_HOST=0.0.0.0 \
    HOME_SCREEN_DB=/data/home_screen.db \
    PORT=7878
VOLUME /data
EXPOSE 7878
WORKDIR /data
USER app
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/settings" || exit 1
ENTRYPOINT ["/usr/local/bin/home_screen"]

# Used by the release workflow: copies the per-architecture binaries it already built
# (docker-bin/amd64/home_screen and docker-bin/arm64/home_screen).
FROM runtime-base AS runtime-prebuilt
ARG TARGETARCH
COPY --chmod=755 docker-bin/${TARGETARCH}/home_screen /usr/local/bin/home_screen

# Default target: built from source.
FROM runtime-base AS runtime
COPY --from=build --chmod=755 /src/target/release/home_screen /usr/local/bin/home_screen
