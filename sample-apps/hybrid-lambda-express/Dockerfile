FROM public.ecr.aws/lambda/nodejs:18

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
