export function getServerlessFromEnv(): "lambda" | "gcp" | undefined {
  // https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-runtime
  if (
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_EXECUTION_ENV?.startsWith("AWS_Lambda_")
  ) {
    return "lambda";
  }

  // https://docs.cloud.google.com/run/docs/configuring/services/environment-variables
  // (see "Additional reserved environment variables when deploying functions")
  if (
    process.env.FUNCTION_TARGET &&
    process.env.FUNCTION_SIGNATURE_TYPE === "http"
  ) {
    return "gcp";
  }

  return undefined;
}
