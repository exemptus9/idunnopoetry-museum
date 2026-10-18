# Universal Writing Canon

This extension reuses existing work IDs and the Museum owner's existing sign-in. It does not infer identities from titles, import historical approval flags as new permission, or replace historical community records.

## Owner journey

1. Open Universal Canon from the Museum Control Center.
2. Load a verified private intake package once. Existing identical witnesses are reused; conflicting identities cannot be overwritten.
3. Review the current selected text, preserved alternatives and explicit source questions.
4. Confirm an exact version and authorship classification. This is independent of permission to publish.
5. Choose a destination and explicitly release that exact version. Existing websites must not be cleared by an empty manifest.

## Preservation boundaries

Text hashes cover exact UTF-8 bytes without newline, punctuation or Unicode normalization. Versions are immutable and edits append new witnesses. Stable work IDs and redirect identities are retained. A new selection does not silently approve it for any public destination.

The verified MAX02 package is the intake source. Private texts and source metadata never belong in this public repository. Test data must be synthetic. Full canon export includes works, immutable witnesses, decisions and release receipts; it is not a backup of authentication, hosting or the original source archives.

## Deployment state

This branch is under development. A connector security check blocked the initial database-definition upload. The current production schema and public archives have not been changed by that blocked attempt. Do not report the new canon backend as operational until its installation and authorization tests are verified.
