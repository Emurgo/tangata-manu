ARG BASE_IMAGE=emurgornd/tangata-manu:base-master

FROM ${BASE_IMAGE} AS dev-build
ARG NPM_REGISTRY
ARG PROXYCHAINS_PROXY_LINE
ENV WORKDIR /usr/src/app

WORKDIR ${WORKDIR}

COPY ./ ${WORKDIR}

RUN /bin/bash -c 'source /docker-assets/bin/npm-registry-setup.functions && \
    npm-registry-setup && \
    ${PROXYCHAIN_CMD} yarn install && \
    npm-registry-cleanup'


# minimal build
FROM node:12-alpine AS prod-build
VOLUME ["/var/log/importer"]
ENV WORKDIR /usr/src/app
WORKDIR ${WORKDIR}
RUN apk add --no-cache bash curl netcat-openbsd
COPY --from=dev-build ${WORKDIR} ${WORKDIR}
ENTRYPOINT ["/usr/src/app/docker-assets/bin/entrypoint"]
