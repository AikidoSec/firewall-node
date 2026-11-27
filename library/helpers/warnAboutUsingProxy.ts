import { colorText } from "./colorText";
import { warnBox } from "./warnBox";

let warned = false;

export function warnAboutUsingProxy(): void {
  if (warned) {
    return;
  }

  warned = true;
  // oxlint-disable-next-line no-console
  console.warn(
    colorText(
      "red",
      warnBox(
        "Zen cannot guarantee full SSRF protection for requests routed through an outbound proxy. The proxy can resolve destination hostnames to IP addresses that Zen cannot inspect. Configure your proxy to block access to private networks and cloud metadata endpoints."
      )
    )
  );
}
