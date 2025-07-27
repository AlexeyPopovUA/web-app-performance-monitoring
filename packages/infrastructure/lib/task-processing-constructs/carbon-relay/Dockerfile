FROM alpine:latest AS installer

# Install curl and necessary tools in alpine
RUN apk update && apk upgrade && apk add curl sed busybox

FROM grafana/carbon-relay-ng:latest AS final

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en

# Define build argument
ARG GRAPHITE_AUTH

# Copy binaries and libraries from alpine image - using wildcards to handle different architectures
COPY --from=installer /usr/bin/curl /usr/bin/curl
COPY --from=installer /bin/sed /bin/sed
COPY --from=installer /bin/sh /bin/sh

# Instead of copying individual libraries, just copy everything we need
COPY --from=installer /lib/ /lib/
COPY --from=installer /usr/lib/ /usr/lib/

# Works only for local docker, but not picked up by load balancer automatically
HEALTHCHECK --interval=35s --timeout=4s CMD /usr/bin/curl -f http://127.0.0.1:8081 || exit 1

ADD ./carbon-relay-ng.ini /conf/carbon-relay-ng.ini
ADD ./carbon-relay-ng.conf /conf/carbon-relay-ng.conf
ADD ./storage-schemas.conf /etc/carbon-relay-ng/storage-schemas.conf
ADD ./storage-aggregation.conf /etc/carbon-relay-ng/storage-aggregation.conf

# Copy sed and its dependencies for text replacement
COPY --from=installer /bin/sed /bin/sed
COPY --from=installer /bin/sh /bin/sh

# Replace the placeholder in the configuration file with the actual secret
RUN /bin/sed -i "s/GRAPHITE_AUTH_PLACEHOLDER/$GRAPHITE_AUTH/g" /conf/carbon-relay-ng.ini