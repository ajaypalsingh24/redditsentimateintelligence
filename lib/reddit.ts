export type RedditAccountReference = {
  input: string;
  username: string;
  accountUrl: string;
  status: "manual_reference";
  note: string;
  actionRequired: string;
};

export function extractRedditUsername(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const urlMatch = trimmed.match(/reddit\.com\/user\/([^/?#]+)/i);
  if (urlMatch?.[1]) {
    return decodeURIComponent(urlMatch[1]).replace(/\/$/g, "");
  }

  return trimmed.replace(/^u\//i, "").replace(/^@/, "").replace(/\/$/g, "");
}

export function getRedditAccountReference(input: string): RedditAccountReference {
  const username = extractRedditUsername(input);
  const accountUrl = username ? `https://www.reddit.com/user/${username}/` : input;

  return {
    input,
    username,
    accountUrl,
    status: "manual_reference",
    note: "This version uses SerpApi and OpenAI only. The Reddit account is saved as a manual reference.",
    actionRequired:
      "Open the profile manually to review account age, karma, recent comments, and whether the tone looks helpful or promotional.",
  };
}
