// Every outward link the site uses, in one place.
const REPO = "https://github.com/daviderez4/nodatachat-core";

export const links = {
  repo: REPO,
  protect: `${REPO}/tree/main/packages/protect`,
  readme: `${REPO}/blob/main/packages/protect/README.md`,
  rules: `${REPO}/blob/main/packages/protect/src/agent-rules.ts`,
  history: `${REPO}/blob/main/packages/protect/src/agent-history.ts`,
  events: `${REPO}/blob/main/packages/protect/src/agent-events.ts`,
  scenarios: `${REPO}/blob/main/site/content/scenarios.json`,
  issues: `${REPO}/issues`,
  newIssue: `${REPO}/issues/new`,
  security: `${REPO}/blob/main/SECURITY.md`,
  releases: `${REPO}/tags`,
  npm: "https://www.npmjs.com/package/@nodatachat/protect",
  nodata: "https://nodatacapsule.com",
};

/**
 * The person behind the project, as they asked to be shown. Empty = the card is not rendered:
 * no guessed name, no guessed profile link.
 */
export const founder = {
  name: "David Erez",
  title: "Founder, NoData",
  linkedin: "https://www.linkedin.com/in/daviderez",
};
