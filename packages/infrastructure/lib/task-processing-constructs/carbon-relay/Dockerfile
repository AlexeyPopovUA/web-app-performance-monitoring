FROM grafana/carbon-relay-ng:latest AS base

ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en

# Define build argument
ARG GRAPHITE_AUTH

RUN apk update && apk upgrade && apk add curl

# Works only for local docker, but not picked up by load balancer automatically
HEALTHCHECK --interval=35s --timeout=4s CMD curl -f http://127.0.0.1:8081 || exit 1

FROM base AS final

ADD ./carbon-relay-ng.ini /conf/carbon-relay-ng.ini
ADD ./carbon-relay-ng.conf /conf/carbon-relay-ng.conf
ADD ./storage-schemas.conf /etc/carbon-relay-ng/storage-schemas.conf
ADD ./storage-aggregation.conf /etc/carbon-relay-ng/storage-aggregation.conf

# Replace the placeholder in the configuration file with the actual secret
RUN sed -i "s/GRAPHITE_AUTH_PLACEHOLDER/$GRAPHITE_AUTH/g" /conf/carbon-relay-ng.ini