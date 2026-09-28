---
name: gitlab-customd-access
description: Set up read-only git access to Deliver Different's CustomD GitLab (git.customd.com) on macOS by decrypting a personal age-encrypted PAT from this repo's secure/ folder and storing it in the macOS Keychain. Use when someone asks to "set up GitLab access", "decrypt the GitLab token", "get access to git.customd.com", or when a clone/fetch from git.customd.com fails with an auth error.
---

# CustomD GitLab access (macOS)

Gets a teammate's Claude Code / git able to `clone` and `fetch` from `https://git.customd.com/...` without anyone pasting a token into chat.

**How it works:** Steve encrypts the GitLab PAT to each person's SSH public key with [age](https://github.com/FiloSottile/age) and commits it as `secure/gitlab-customd-token-<name>.age`. Only that person's private key can decrypt it. The decrypted PAT goes into the macOS Keychain, and git picks it up automatically.

## Rules

- **Read-only.** Use this access for `clone`, `fetch`, `pull`, `ls-remote` and reading via the API. Never push, open MRs, or change anything on git.customd.com.
- **Never print the token.** Don't `cat` the env file, echo `$GITLAB_PAT`, or paste it into chat, commits, or logs.
- **Credential steps are the user's to run.** Claude Code's auto-mode classifier usually blocks Claude from decrypting or storing credentials. When it does, don't work around it — give the user the command and have them run it themselves with the `!` prefix in the Claude Code prompt (e.g. `! age -d ...`), or in their own Terminal.

## Step 0 — Does this person have an encrypted file yet?

```bash
ls secure/ 2>/dev/null || gh api repos/Deliver-Different-Testing/despatchwebchanges/contents/secure --jq '.[].name'
```

Look for `gitlab-customd-token-<their-name>.age`.

**If there's no file for them:** they need Steve to create one. Print their public key and tell them to send it to Steve:

```bash
cat ~/.ssh/id_ed25519.pub   # or ~/.ssh/id_rsa.pub
```

No key? Create one: `ssh-keygen -t ed25519 -C "<name>@deliverdifferent"`, then send the `.pub`. Stop here until Steve has pushed their file.

## Step 1 — Install age

```bash
command -v age || brew install age
```

## Step 2 — Download and decrypt (user runs this)

Replace `<name>` with their file's name part. The repo is public, so no GitHub auth is needed to download.

```bash
NAME=<name>
curl -fsSL -o /tmp/gitlab-token.age \
  "https://raw.githubusercontent.com/Deliver-Different-Testing/despatchwebchanges/main/secure/gitlab-customd-token-$NAME.age"
age -d -i ~/.ssh/id_ed25519 -o ~/.gitlab-customd.env /tmp/gitlab-token.age
chmod 600 ~/.gitlab-customd.env
rm /tmp/gitlab-token.age
```

- The key is passphrase-protected → age prompts for it. That's expected.
- `no identity matched any of the recipients` → the file wasn't encrypted to this key (wrong key file, or Steve used a different public key). Try `-i ~/.ssh/id_rsa`, else send Steve the right `.pub`.

The env file contains `GITLAB_HOST`, `GITLAB_USERNAME` and `GITLAB_PAT`.

## Step 3 — Store it in the macOS Keychain (user runs this)

```bash
set -a; source ~/.gitlab-customd.env; set +a
H=$(printf '%s' "$GITLAB_HOST" | sed -E 's#^https?://##; s#/.*$##')
git config --global "credential.https://$H.helper" ""
git config --global --add "credential.https://$H.helper" osxkeychain
git config --global "credential.https://$H.username" "$GITLAB_USERNAME"
printf 'protocol=https\nhost=%s\nusername=%s\npassword=%s\n\n' "$H" "$GITLAB_USERNAME" "$GITLAB_PAT" \
  | git credential-osxkeychain store
unset GITLAB_PAT
```

The empty `helper ""` line clears any global helper (e.g. Git Credential Manager) for this host only. Without it, GCM detects GitLab and tries an OAuth browser login instead of using the stored PAT.

## Step 4 — Verify (Claude can run this)

```bash
GIT_TERMINAL_PROMPT=0 git ls-remote --heads https://git.customd.com/urgent-couriers/dfrntdrive_configurator.git | head -5
```

Branch names back → done. `git clone https://git.customd.com/<group>/<repo>.git` now works in any session.

| Symptom | Fix |
|---|---|
| `could not read Username/Password ... terminal prompts disabled` | Keychain entry missing or wrong. Re-run Step 3. |
| Browser pops up / `missing OAuth configuration` | GCM is still handling the host. Re-run the `helper` lines in Step 3. |
| `HTTP 401` / `Authentication failed` | The token is wrong or revoked. Tell Steve. |
| `HTTP 404` on a repo you expect | The PAT's account can't see that project. Tell Steve. Don't guess other paths. |

## For Steve — adding a new person

From a machine holding the decrypted env file (Windows PowerShell shown, where `age` is installed via winget):

```powershell
Set-Content "$env:TEMP\recipient.pub" "<their ssh public key line>" -Encoding ascii
age -R "$env:TEMP\recipient.pub" -o secure\gitlab-customd-token-<name>.age "$HOME\.gitlab-customd.env"
Remove-Item "$env:TEMP\recipient.pub"
git add secure\gitlab-customd-token-<name>.age; git commit -m "Add GitLab token handoff for <name>"; git push
```

**Revoking someone:** delete their `.age` file. That stops new setups, but they already have the token, so rotate the PAT on CustomD and re-encrypt it for everyone else.
