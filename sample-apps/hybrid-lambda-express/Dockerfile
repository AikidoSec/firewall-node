# Patched Node binary (CVE-2026-111497). Drop once the Lambda base image ships >= 24.22.1.
FROM node:24.22.1-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS node

FROM public.ecr.aws/lambda/nodejs:24.2026.10.13.11@sha256:25ca7feadc0e22b6ba2fea0a72be65cd78f2dc40f9db296db813c4ddf7eaf7f3

COPY --from=node /usr/local/bin/node /var/lang/bin/node

COPY package.json ${LAMBDA_TASK_ROOT}
COPY package-lock.json ${LAMBDA_TASK_ROOT}
COPY handler.js ${LAMBDA_TASK_ROOT}
COPY app.js ${LAMBDA_TASK_ROOT}

# Copy the dev firewall package
COPY aikidosec-firewall-*.tgz ${LAMBDA_TASK_ROOT}

RUN npm ci && \
    npm uninstall @aikidosec/firewall && \
    npm install ./aikidosec-firewall-*.tgz

CMD [ "handler.handler" ]
